$ErrorActionPreference='Stop'
$taskRoot=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $taskRoot
$taskPython=if($env:CURSE_PYTHON){$env:CURSE_PYTHON}else{'python'}
$taskSource=Join-Path $taskRoot 'reports\tools\munt'
$taskCommit='6e7c01fba7e1d50c8fa705834889fd0eac136075'
$taskCmake=Join-Path $taskRoot 'reports\tool-build-deps\cmake\data\bin\cmake.exe'
if(-not(Test-Path -LiteralPath $taskCmake)){
  & $taskPython -m pip install --target reports/tool-build-deps cmake==3.31.6 mido==1.3.3
  if($LASTEXITCODE -ne 0){throw 'No se pudieron preparar CMake y Mido'}
}
if(-not(Test-Path -LiteralPath $taskSource)){
  git clone --depth 1 https://github.com/munt/munt.git $taskSource
  if($LASTEXITCODE -ne 0){throw 'No se pudo obtener Munt'}
  git -C $taskSource fetch --depth 1 origin $taskCommit
  if($LASTEXITCODE -ne 0){throw 'No se pudo obtener la revisión fijada'}
  git -C $taskSource checkout --detach $taskCommit
  if($LASTEXITCODE -ne 0){throw 'No se pudo fijar la revisión'}
}
if((git -C $taskSource rev-parse HEAD) -ne $taskCommit){throw 'La copia local de Munt tiene otra revisión; no se modifica'}
& $taskCmake -S reports/tools/munt/mt32emu -B reports/tools/munt-build -G 'Visual Studio 17 2022' -A x64 -Dlibmt32emu_SHARED=ON -Dlibmt32emu_CPP_INTERFACE=OFF -DBUILD_TESTING=OFF
if($LASTEXITCODE -ne 0){throw 'Se necesita Visual Studio 2022 con herramientas C++ y Windows SDK'}
& $taskCmake --build reports/tools/munt-build --config Release --parallel 4
if($LASTEXITCODE -ne 0){throw 'Falló la compilación local de Munt'}
Write-Output 'Munt preparado localmente. Ejecuta pnpm audio:prepare; se necesitan tus ROM y MIDI.'
