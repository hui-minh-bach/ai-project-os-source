; Worker C PRIVATE QA preview only. Integration owner owns final release.
; Compiler example: ISCC.exe /DPayloadDir=C:\work\staged /DProductVersion=<Personal RELEASE.json version> WorkerC-Internal-RC.iss
#ifndef PayloadDir
  #error PayloadDir must contain a validated app + bundled official Node 22 runtime.
#endif
#ifndef ProductVersion
  #error ProductVersion must come from Personal RELEASE.json.
#endif
#define ProductName "AI Project OS Personal Edition - INTERNAL RC"
[Setup]
AppId={{378F22E7-452B-4825-A123-B2D85C1C0526}
AppName={#ProductName}
AppVersion={#ProductVersion}
AppPublisher=AI Project OS - internal QA only
DefaultDirName={localappdata}\Programs\AIProjectOSPersonal
DefaultGroupName=AI Project OS Personal
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir={#SourcePath}\output
OutputBaseFilename=AIProjectOSPersonal-{#ProductVersion}-UNSIGNED-INTERNAL-RC
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
DisableDirPage=auto
UninstallDisplayName={#ProductName}
; Do NOT add [UninstallDelete] for customer data or backup trees.
[Files]
Source: "{#PayloadDir}\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion
[Icons]
Name: "{autoprograms}\AI Project OS Personal (INTERNAL RC)"; Filename: "{app}\AI-Project-OS.exe"; WorkingDir: "{app}"
Name: "{autodesktop}\AI Project OS Personal (INTERNAL RC)"; Filename: "{app}\AI-Project-OS.exe"; WorkingDir: "{app}"; Tasks: desktopicon
[Tasks]
Name: "desktopicon"; Description: "Tạo lối tắt Desktop"; GroupDescription: "Lối tắt:"; Flags: unchecked
; Deliberately no updater, silent install, provider token or auto-run.
; Signing certificate and signed update manifests are mandatory before commercial release.
