!macro preInit
  ; 在安装前执行的代码
  SetRegView 64
  WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "$INSTDIR"
  WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "$INSTDIR"
!macroend

!macro customInit
  ; 自定义初始化代码
  ${IfNot} ${Silent}
    ; 显示欢迎信息
    MessageBox MB_OK|MB_ICONINFORMATION "欢迎安装 GameVoice - 游戏开黑语音程序$\n$\n低延迟语音聊天，专为游戏玩家设计。"
  ${EndIf}
!macroend

!macro customInstall
  ; 自定义安装代码
  ; 创建桌面快捷方式
  CreateShortCut "$DESKTOP\GameVoice.lnk" "$INSTDIR\GameVoice.exe"

  ; 创建开始菜单快捷方式
  CreateDirectory "$SMPROGRAMS\GameVoice"
  CreateShortCut "$SMPROGRAMS\GameVoice\GameVoice.lnk" "$INSTDIR\GameVoice.exe"
  CreateShortCut "$SMPROGRAMS\GameVoice\卸载 GameVoice.lnk" "$INSTDIR\Uninstall GameVoice.exe"

  ; 写入注册表信息
  WriteRegStr HKLM "Software\GameVoice" "Version" "0.1.0"
  WriteRegStr HKLM "Software\GameVoice" "InstallPath" "$INSTDIR"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\GameVoice" "DisplayName" "GameVoice"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\GameVoice" "UninstallString" "$INSTDIR\Uninstall GameVoice.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\GameVoice" "DisplayIcon" "$INSTDIR\GameVoice.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\GameVoice" "Publisher" "GameVoice Team"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\GameVoice" "DisplayVersion" "0.1.0"
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\GameVoice" "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\GameVoice" "NoRepair" 1
!macroend

!macro customUnInstall
  ; 自定义卸载代码
  ; 删除桌面快捷方式
  Delete "$DESKTOP\GameVoice.lnk"

  ; 删除开始菜单文件夹
  RMDir /r "$SMPROGRAMS\GameVoice"

  ; 删除注册表信息
  DeleteRegKey HKLM "Software\GameVoice"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\GameVoice"

  ; 删除用户数据
  ${If} ${FileExists} "$APPDATA\GameVoice"
    RMDir /r "$APPDATA\GameVoice"
  ${EndIf}

  ${If} ${FileExists} "$LOCALAPPDATA\GameVoice"
    RMDir /r "$LOCALAPPDATA\GameVoice"
  ${EndIf}
!macroend

!macro customInstallMode
  ; 自定义安装模式
  ${IfNot} ${Silent}
    ; 询问用户是否创建桌面快捷方式
    MessageBox MB_YESNO|MB_ICONQUESTION "是否创建桌面快捷方式？" IDYES createDesktopShortcut
    Goto skipDesktopShortcut

    createDesktopShortcut:
      CreateShortCut "$DESKTOP\GameVoice.lnk" "$INSTDIR\GameVoice.exe"

    skipDesktopShortcut:
  ${EndIf}
!macroend