# AudioCapturer - Native Multi-Device Audio Capture

A C# Windows application that captures audio from multiple output devices simultaneously (e.g., Arctis 7 Chat + Game channels) and mixes them into a single WAV file.

## Features

- **Multi-device loopback capture**: Captures audio from multiple Windows audio output devices using WASAPI
- **Auto-detection**: Automatically finds and captures all "Arctis" devices
- **Microphone support**: Also captures from the default communication microphone
- **High-quality mixing**: Uses NAudio's professional mixing with proper resampling
- **Stop file mechanism**: Clean shutdown via a signal file (works with Electron)
- **Self-contained**: Compiles to a single executable with .NET runtime embedded (~34 MB)

## Requirements

### For Development

- .NET SDK 8.0+
- Windows 10/11

### For Users

- Windows 10/11 (no additional dependencies needed)

## Build Instructions

```bash
# Restore packages
dotnet restore

# Build debug
dotnet build

# Publish self-contained executable
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true
```

Output: `bin/Release/net8.0/win-x64/publish/AudioCapturer.exe`

## Usage

### List available devices

```bash
AudioCapturer.exe --list
```

### Record audio (auto-detect Arctis devices)

```bash
AudioCapturer.exe --output recording.wav --stopfile stop.signal
```

### Record specific devices

```bash
AudioCapturer.exe --output recording.wav --stopfile stop.signal --devices "Arctis 7 Chat,Arctis 7 Game"
```

### Stop recording

Create the stop file specified in `--stopfile` to gracefully stop recording:

```bash
echo STOP > stop.signal
```

## Output Format

- **Format**: WAV (PCM)
- **Sample Rate**: 48000 Hz
- **Bit Depth**: 16-bit
- **Channels**: 2 (stereo)

## Integration with Electron

The VoxScribe Electron app uses this executable:

1. **Start**: Spawns `AudioCapturer.exe` with `--output` and `--stopfile` arguments
2. **During recording**: Audio is captured and buffered in memory
3. **Stop**: Creates the stop file, waits for process to exit
4. **Result**: Reads the generated WAV file

## Architecture

```
DataAvailable callbacks  →  BufferedWaveProviders  →  MixingSampleProvider  →  WAV File
(per device, async)         (thread-safe buffers)     (professional mixing)    (on stop)
```

## License

MIT
