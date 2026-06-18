; ================================================================
; Indica Chat - Custom Installer Pages
; Page order (automatic by electron-builder):
;   1. Choose Installation Options  ← built-in multiuser page
;   2. Setup Preferences            ← our custom page (injected via customWelcomePage)
;   3. Choose Install Location      ← built-in directory page
;   4. Installing                   ← built-in instfiles page
; ================================================================

!include "nsDialogs.nsh"
!include "LogicLib.nsh"

; ================================================================
; These declarations must be outside any build guard
; ================================================================
!macro customHeader
!macroend

!macro customInit
  StrCpy $stateStartup  "0"
  StrCpy $stateTaskbar  "0"
  StrCpy $stateDesktop  "1"

  InitPluginsDir
  File "/oname=$PLUGINSDIR\bg.ps1" "${BUILD_RESOURCES_DIR}\bg.ps1"
  Exec 'powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File "$PLUGINSDIR\bg.ps1"'
!macroend

; ================================================================
; Only compile the installer-side pages during installer build
; (not during the uninstaller build pass)
; ================================================================
!ifndef BUILD_UNINSTALLER

  ; Variables only needed for installer
  Var chkStartup
  Var chkTaskbar
  Var chkDesktop
  Var stateStartup
  Var stateTaskbar
  Var stateDesktop

  ; ================================================================
  ; customWelcomePage is injected by electron-builder AFTER the
  ; built-in multiuser (Choose Installation Options) page and BEFORE
  ; the directory and instfiles pages.
  ; So final order is:
  ;   [built-in] Choose Installation Options
  ;   [custom]   Setup Preferences  ← this macro
  ;   [built-in] Choose Install Location
  ;   [built-in] Installing
  ; ================================================================
  !macro customWelcomePage
    Page custom OptionsPage_Show OptionsPage_Leave
  !macroend

  ; ================================================================
  ; Setup Preferences page – Show
  ; ================================================================
  Function OptionsPage_Show

    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}

    ; --- Heading ---
    ${NSD_CreateLabel} 0 0 300 18 "Setup Preferences"
    Pop $1
    CreateFont $9 "Segoe UI" 11 700
    SendMessage $1 ${WM_SETFONT} $9 1

    ${NSD_CreateLabel} 0 22 300 14 "Choose additional options before installing Indica Chat."
    Pop $1

    ; --- Divider ---
    ${NSD_CreateHLine} 0 42 300 1
    Pop $1

    ; --- Startup checkbox ---
    ${NSD_CreateCheckbox} 0 52 300 16 " Launch Indica Chat on Windows Startup"
    Pop $chkStartup
    ${If} $stateStartup == "1"
      ${NSD_Check} $chkStartup
    ${EndIf}

    ${NSD_CreateLabel} 16 71 284 11 "Indica Chat will open automatically when Windows starts."
    Pop $1

    ; --- Taskbar checkbox ---
    ${NSD_CreateCheckbox} 0 88 300 16 " Pin to Taskbar"
    Pop $chkTaskbar
    ${If} $stateTaskbar == "1"
      ${NSD_Check} $chkTaskbar
    ${EndIf}

    ${NSD_CreateLabel} 16 107 284 11 "Creates a taskbar shortcut for quick access."
    Pop $1

    ; --- Desktop checkbox ---
    ${NSD_CreateCheckbox} 0 124 300 16 " Create Desktop Shortcut"
    Pop $chkDesktop
    ${If} $stateDesktop == "1"
      ${NSD_Check} $chkDesktop
    ${EndIf}

    ${NSD_CreateLabel} 16 143 284 11 "Adds a shortcut to your desktop for easy launching."
    Pop $1

    ; Admin elevation is handled automatically on first launch by the app itself.

    ; --- Divider ---
    ${NSD_CreateHLine} 0 164 300 1
    Pop $1

    nsDialogs::Show

  FunctionEnd

  ; ================================================================
  ; Setup Preferences page – Save choices when user clicks Next
  ; ================================================================
  Function OptionsPage_Leave

    ${NSD_GetState} $chkStartup $stateStartup
    ${NSD_GetState} $chkTaskbar $stateTaskbar
    ${NSD_GetState} $chkDesktop $stateDesktop

    ${If} $stateStartup == ${BST_CHECKED}
      StrCpy $stateStartup "1"
    ${Else}
      StrCpy $stateStartup "0"
    ${EndIf}

    ${If} $stateTaskbar == ${BST_CHECKED}
      StrCpy $stateTaskbar "1"
    ${Else}
      StrCpy $stateTaskbar "0"
    ${EndIf}

    ${If} $stateDesktop == ${BST_CHECKED}
      StrCpy $stateDesktop "1"
    ${Else}
      StrCpy $stateDesktop "0"
    ${EndIf}

  FunctionEnd

  ; ================================================================
  ; Apply saved options during actual installation
  ; ================================================================
  !macro customInstall

    ; ---- Apply: Windows Startup ----
    ${If} $stateStartup == "1"
      WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Indica Chat" "$\"$INSTDIR\Indica Chat.exe$\""
    ${Else}
      DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Indica Chat"
    ${EndIf}

    ; Admin elevation is handled automatically on first launch by the app (one-time UAC prompt).

    ; ---- Apply: Pin to Taskbar ----
    ${If} $stateTaskbar == "1"
      CreateShortCut "$APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar\Indica Chat.lnk" "$INSTDIR\Indica Chat.exe" "" "$INSTDIR\Indica Chat.exe" 0
    ${EndIf}

    ; ---- Apply: Desktop Shortcut ----
    ${If} $stateDesktop == "1"
      CreateShortCut "$DESKTOP\Indica Chat.lnk" "$INSTDIR\Indica Chat.exe" "" "$INSTDIR\Indica Chat.exe" 0
    ${EndIf}

  !macroend

!else
  ; Stub macros needed during uninstaller build pass
  !macro customWelcomePage
  !macroend
  !macro customInstall
  !macroend
!endif

; ================================================================
; Clean up on uninstall
; ================================================================
!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Indica Chat"
  ; No RUNASADMIN registry entry to clean up (managed by the app itself)
  Delete "$APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar\Indica Chat.lnk"
  Delete "$DESKTOP\Indica Chat.lnk"
!macroend
