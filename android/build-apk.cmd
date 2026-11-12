@echo off
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
set PATH=%JAVA_HOME%\bin;%PATH%
cd /d "%~dp0"
echo Java:
java -version 2>&1
echo Gradle:
gradlew.bat assembleDebug --console=plain