"""Convertir RS/MPU a MIDI y contrastar cada evento y tick con DOSBox-X.

Requiere mido. No modifica originales ni audios activos. La captura usa resolución
de 1 ms; el MIDI exportado conserva ticks musicales de 120 PPQ y el tempo del EXE.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import mido

EXE_SHA = 'f2c0046e07b25f408516edae5d6a66c06107971fb95c55ed770fa52a6b4ecd8d'

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def decode(data, offset=0, status=None, ticks=0):
    """F8 añade 240 ticks; F9 marca compás sin añadir tiempo artificial."""
    events=[]; boundaries={};i=offset
    while i<len(data):
        at=i;boundaries[at]=ticks
        delay=data[i];i+=1
        if delay==0xff:
            assert i==len(data)-2, ('loop footer',at)
            return events,ticks,status,boundaries
        if delay==0xf8:
            ticks+=240
            continue
        if delay==0xf9:continue
        assert delay<0xf0,('timing opcode',at,delay)
        ticks+=delay;b=data[i]
        if b==0xf9:
            i+=1;continue
        assert b<0xf0,('unexpected status',at,b)
        if b>=0x80:status=b;i+=1
        assert status is not None
        size=1 if status>>4 in (0xc,0xd) else 2
        payload=bytes([status])+data[i:i+size];i+=size
        assert all(x<0x80 for x in payload[1:])
        events.append((ticks,payload,at))
    raise ValueError('Missing loop footer')

def read_capture(path):
    midi=mido.MidiFile(path);assert midi.type==0 and midi.ticks_per_beat==500
    ticks=0;events=[]
    for message in midi.tracks[0]:
        ticks+=message.time
        assert message.type!='set_tempo' or message.tempo==500000
        if not message.is_meta:events.append((ticks,bytes(message.bytes())))
    return events

def write_midi(path,events,bpm,end,markers):
    midi=mido.MidiFile(type=0,ticks_per_beat=120);track=mido.MidiTrack();midi.tracks.append(track)
    track.append(mido.MetaMessage('set_tempo',tempo=round(60_000_000/bpm),time=0))
    items=[(tick,1,mido.Message.from_bytes(list(payload))) for tick,payload,*_ in events]
    items += [(tick,0,mido.MetaMessage('marker',text=name)) for name,tick in markers.items()]
    previous=0
    for tick,_,message in sorted(items,key=lambda e:(e[0],e[1])):
        track.append(message.copy(time=tick-previous));previous=tick
    track.append(mido.MetaMessage('end_of_track',time=end-previous))
    midi.save(path)

def verify(root,captures,output):
    exe=root/'original/CURSE.EXE';assert sha(exe)==EXE_SHA
    raw=exe.read_bytes();load=struct.unpack_from('<H',raw,8)[0]*16
    tempos=[raw[load+0xf310+0x80b9+4*i] for i in range(5)]
    assert tempos==[140,135,140,125,110],tempos
    reports=[];output.mkdir(parents=True,exist_ok=True)
    for number,bpm in enumerate(tempos,1):
        source=root/f'original/DATA/CURSE.RS{number}';data=source.read_bytes()
        first,end,status,bounds=decode(data)
        loop_offset=struct.unpack_from('<H',data,len(data)-2)[0]
        assert loop_offset in bounds
        loop_start=bounds[loop_offset];period=end-loop_start
        repeated,repeat_end,repeat_status,_=decode(data,loop_offset,status,end)
        assert repeat_end-end==period
        next_repeat,next_end,_,_=decode(data,loop_offset,repeat_status,repeat_end)
        assert [p for _,p,_ in repeated]==[p for _,p,_ in next_repeat]
        paths=list((captures/f'rs{number}/captures').glob('*.mid'));assert paths
        capture_path=max(paths,key=lambda p:p.stat().st_size)
        capture=read_capture(capture_path);signature=[p for _,p,_ in first]
        start=next(s for s in range(len(capture)-len(first))
                   if [p for _,p in capture[s:s+len(first)]]==signature)
        observed=capture[start:];expected=list(first)
        cycle=list(repeated);cycle_end=repeat_end
        while len(expected)<len(observed):
            expected.extend(cycle)
            cycle=[(t+period,p,o) for t,p,o in cycle];cycle_end+=period
        expected=expected[:len(observed)]
        assert [p for _,p in observed]==[p for _,p,_ in expected],('event mismatch',number)
        differences=[ms-observed[0][0]-tick*60000/(bpm*120)
                     for (ms,_),(tick,_,_) in zip(observed,expected)]
        assert max(abs(d) for d in differences)<=2.01,('timing mismatch',number,min(differences),max(differences))
        assert len(observed)>=len(first)+len(repeated),('need complete repeated cycle',number)
        old=mido.MidiFile(root/f'assets/original/musica/CURSE.RS{number}.mid')
        old_notes=[(m.channel,m.note,m.velocity) for m in old if not m.is_meta and m.type=='note_on']
        new_notes=[(m.channel,m.note,m.velocity) for _,p,_ in first if (m:=mido.Message.from_bytes(list(p))).type=='note_on']
        assert sorted(old_notes)==sorted(new_notes),('previous note content changed',number)
        name=f'CURSE.RS{number}'
        write_midi(output/f'{name}.mid',first,bpm,end,{'NATIVE_LOOP_START':loop_start,'NATIVE_LOOP_END':end})
        # Segunda vuelta explícita: conserva running status e instrumentos heredados.
        write_midi(output/f'{name}.expanded.mid',first+repeated,bpm,repeat_end,
                   {'NATIVE_FIRST_LOOP_ENTRY':loop_start,'LOOP_START':end,'LOOP_END':repeat_end})
        first_loop=[p for t,p,o in first if o>=loop_offset]
        changed=[j for j,(a,b) in enumerate(zip(first_loop,[p for _,p,_ in repeated])) if a!=b]
        reports.append({'track':name,'nativeBpm':bpm,'ppq':120,'sourceSha256':sha(source),
                        'capture':str(capture_path),'captureSha256':sha(capture_path),
                        'firstPassEvents':len(first),'verifiedCapturedEvents':len(observed),
                        'maxTimingDifferenceMs':max(abs(d) for d in differences),
                        'loopOffset':loop_offset,'nativeLoopStartTick':loop_start,'firstPassEndTick':end,
                        'loopPeriodTicks':period,'expandedLoopStartSeconds':end*60/(bpm*120),
                        'expandedLoopEndSeconds':repeat_end*60/(bpm*120),
                        'firstVsRepeatedChangedEvents':changed,
                        'midiSha256':sha(output/f'{name}.mid'),'expandedMidiSha256':sha(output/f'{name}.expanded.mid')})
        print(json.dumps(reports[-1]),flush=True)
    report={'schemaVersion':1,'exeSha256':EXE_SHA,'status':'all five verified against isolated native DOSBox-X playback',
            'captureClockResolutionMs':1,'tracks':reports,
            'limits':['Native player invoked through debugger; not a gameplay walkthrough.',
                      'DOSBox-X raw recorder activation instrumented; game EXE unchanged.',
                      'No comparison with physical MT-32 hardware. MIDI rounding of tempo is under 0.001 ms per beat.']}
    (output/'verification.json').write_text(json.dumps(report,indent=2)+'\n')
    return report

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',type=Path,required=True)
    parser.add_argument('--captures',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args();verify(args.root,args.captures,args.output)
