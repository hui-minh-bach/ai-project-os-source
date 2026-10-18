; Worker C PRIVATE QA preview only. Integration owner owns final release.
; Compiler example: ISCC.exe /DPayloadDir=C:\work\staged /DProductVersion=0.8.5-rc WorkerC-Internal-RC.iss
#ifndef PayloadDir
  #error PayloadDir must contain a validated app + bundled official Node 22 runtime.
#endif
#ifndef ProductVersion
  #define ProductVersion "0.8.5-rc"
#endif
#define ProductName "AI Project OS Local - INTERNAL RC"
[Setup]
AppId={{4B8FB2BB-7D4F-4AE0-91BA-8D90C76D8861}
AppName={#ProductName}
AppVersion={#ProductVersion}
AppPublisher=AI Project OS - internal QA only
DefaultDirName={localappdata}\Programs\AIProjectOSLocal
DefaultGroupName=AI Project OS Local
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir={#SourcePath}\output
OutputBaseFilename=AIProjectOS-{#ProductVersion}-UNSIGNED-INTERNAL-RC
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
DisableDirPage=auto
UninstallDisplayName={#ProductName}
; Do NOT add [UninstallDelete] for customer data or backup trees.
[Files]
Source: "{#PayloadDir}\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion
[Icons]
Name: "{autoprograms}\AI Project OS Local (INTERNAL RC)"; Filename: "{app}\AI-Project-OS.exe"; WorkingDir: "{app}"
Name: "{autodesktop}\AI Project OS Local (INTERNAL RC)"; Filename: "{app}\AI-Project-OS.exe"; WorkingDir: "{app}"; Tasks: desktopicon
[Tasks]
Name: "desktopicon"; Description: "Tạo lối tắt Desktop"; GroupDescription: "Lối tắt:"; Flags: unchecked
; Deliberately no updater, silent install, provider token or auto-run.
; Signing certificate and signed update manifests are mandatory before commercial release.
