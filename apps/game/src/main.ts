import { Application, Graphics, Text } from 'pixi.js';
import { VERBS } from '@curse/engine';

const app = new Application();
await app.init({ width: 960, height: 600, background: '#101827', antialias: false });
document.querySelector<HTMLDivElement>('#app')!.appendChild(app.canvas);
app.canvas.style.cssText = 'display:block;max-width:100%;height:auto;margin:auto;image-rendering:pixelated';
app.stage.addChild(new Graphics().rect(0,0,960,430).fill('#27384b'));
const heading = new Text({text:'CURSE — ENGINE PLAYGROUND',style:{fill:'#ffe2a3',fontFamily:'monospace',fontSize:28}});
heading.position.set(45,60); app.stage.addChild(heading);
const subtitle = new Text({text:'Placeholder scene — original assets not loaded',style:{fill:'#ffffff',fontFamily:'monospace',fontSize:17}});
subtitle.position.set(45,110); app.stage.addChild(subtitle);
app.stage.addChild(new Graphics().rect(0,430,960,170).fill('#141c2a'));
const status = new Text({text:'Selected: LOOK',style:{fill:'#ffe2a3',fontFamily:'monospace',fontSize:18}});
status.position.set(25,555); app.stage.addChild(status);
VERBS.forEach((verb,i)=>{ const x=25+(i%4)*232, y=445+Math.floor(i/4)*47; const button=new Graphics().roundRect(x,y,210,38,5).fill('#364960'); button.eventMode='static'; button.cursor='pointer'; button.on('pointertap',()=>{status.text=`Selected: ${verb}`;}); app.stage.addChild(button); const label=new Text({text:verb,style:{fill:'#ffffff',fontFamily:'monospace',fontSize:16}}); label.position.set(x+12,y+8); app.stage.addChild(label); });
