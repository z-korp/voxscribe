using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using NAudio.CoreAudioApi;
using NAudio.Wave;
using NAudio.Wave.SampleProviders;

namespace AudioCapturer
{
    class Program
    {
        private static bool _running = true;
        
        static int Main(string[] args)
        {
            try
            {
                Console.CancelKeyPress += (s, e) =>
                {
                    e.Cancel = true;
                    _running = false;
                    Console.Error.WriteLine("INFO: Ctrl+C received");
                };

                if (args.Length > 0 && args[0] == "--list")
                {
                    ListDevices();
                    return 0;
                }

                string outputPath = Path.Combine(Path.GetTempPath(), $"capture_{DateTime.Now:yyyyMMdd_HHmmss}.wav");
                string? stopFilePath = null;
                var deviceNames = new List<string>();
                
                for (int i = 0; i < args.Length; i++)
                {
                    if (args[i] == "--output" && i + 1 < args.Length)
                        outputPath = args[i + 1];
                    if (args[i] == "--stopfile" && i + 1 < args.Length)
                        stopFilePath = args[i + 1];
                    if (args[i] == "--devices" && i + 1 < args.Length)
                        deviceNames = args[i + 1].Split(',').Select(d => d.Trim()).ToList();
                }

                CaptureToFile(outputPath, deviceNames, stopFilePath);
                Console.WriteLine(outputPath);
                return 0;
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"ERROR: {ex.Message}");
                return 1;
            }
        }

        static void ListDevices()
        {
            var enumerator = new MMDeviceEnumerator();
            Console.WriteLine("=== Output Devices ===");
            foreach (var d in enumerator.EnumerateAudioEndPoints(DataFlow.Render, DeviceState.Active))
                Console.WriteLine($"Name: {d.FriendlyName}");
            Console.WriteLine("\n=== Input Devices ===");
            foreach (var d in enumerator.EnumerateAudioEndPoints(DataFlow.Capture, DeviceState.Active))
                Console.WriteLine($"Name: {d.FriendlyName}");
        }

        static void CaptureToFile(string outputPath, List<string> targetDeviceNames, string? stopFilePath)
        {
            var enumerator = new MMDeviceEnumerator();
            var allOutputDevices = enumerator.EnumerateAudioEndPoints(DataFlow.Render, DeviceState.Active).ToList();

            List<MMDevice> devicesToCapture;
            if (targetDeviceNames.Any())
                devicesToCapture = allOutputDevices.Where(d => targetDeviceNames.Any(name => d.FriendlyName.Contains(name, StringComparison.OrdinalIgnoreCase))).ToList();
            else
            {
                devicesToCapture = allOutputDevices.Where(d => d.FriendlyName.Contains("Arctis", StringComparison.OrdinalIgnoreCase)).ToList();
                if (!devicesToCapture.Any())
                    devicesToCapture.Add(enumerator.GetDefaultAudioEndpoint(DataFlow.Render, Role.Multimedia));
            }

            Console.Error.WriteLine($"INFO: Capturing {devicesToCapture.Count} device(s):");
            foreach (var d in devicesToCapture) Console.Error.WriteLine($"  - {d.FriendlyName}");

            var targetFormat = WaveFormat.CreateIeeeFloatWaveFormat(48000, 2);
            
            var captures = new List<WasapiLoopbackCapture>();
            var waveProviders = new List<BufferedWaveProvider>();
            
            foreach (var device in devicesToCapture)
            {
                var capture = new WasapiLoopbackCapture(device);
                captures.Add(capture);
                
                var buffer = new BufferedWaveProvider(capture.WaveFormat)
                {
                    BufferLength = capture.WaveFormat.AverageBytesPerSecond * 60, // 60 sec buffer
                    DiscardOnBufferOverflow = true,
                    ReadFully = false
                };
                waveProviders.Add(buffer);
                
                Console.Error.WriteLine($"INFO: {device.FriendlyName} -> {capture.WaveFormat.SampleRate}Hz {capture.WaveFormat.BitsPerSample}bit {capture.WaveFormat.Channels}ch");
                
                capture.DataAvailable += (s, e) =>
                {
                    if (_running && e.BytesRecorded > 0)
                        buffer.AddSamples(e.Buffer, 0, e.BytesRecorded);
                };
            }
            
            // Microphone
            WasapiCapture? micCapture = null;
            BufferedWaveProvider? micBuffer = null;
            
            try
            {
                var mic = enumerator.GetDefaultAudioEndpoint(DataFlow.Capture, Role.Communications);
                Console.Error.WriteLine($"INFO: Mic: {mic.FriendlyName}");
                
                micCapture = new WasapiCapture(mic);
                micBuffer = new BufferedWaveProvider(micCapture.WaveFormat)
                {
                    BufferLength = micCapture.WaveFormat.AverageBytesPerSecond * 60,
                    DiscardOnBufferOverflow = true,
                    ReadFully = false
                };
                
                Console.Error.WriteLine($"INFO: Mic -> {micCapture.WaveFormat.SampleRate}Hz {micCapture.WaveFormat.BitsPerSample}bit {micCapture.WaveFormat.Channels}ch");
                
                micCapture.DataAvailable += (s, e) =>
                {
                    if (_running && e.BytesRecorded > 0)
                        micBuffer.AddSamples(e.Buffer, 0, e.BytesRecorded);
                };
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"WARNING: No mic: {ex.Message}");
            }

            // Start captures
            foreach (var c in captures) c.StartRecording();
            micCapture?.StartRecording();
            
            Console.Error.WriteLine("INFO: Recording... Waiting for stop signal.");
            if (stopFilePath != null)
                Console.Error.WriteLine($"INFO: Stop file: {stopFilePath}");

            // Wait for stop signal (check stop file every 100ms)
            while (_running)
            {
                if (stopFilePath != null && File.Exists(stopFilePath))
                {
                    Console.Error.WriteLine("INFO: Stop file detected!");
                    _running = false;
                    try { File.Delete(stopFilePath); } catch { }
                    break;
                }
                Thread.Sleep(100);
            }

            // Stop captures
            Console.Error.WriteLine("INFO: Stopping captures...");
            foreach (var c in captures) c.StopRecording();
            micCapture?.StopRecording();
            
            Thread.Sleep(500); // Let buffers flush

            // Mix and write
            Console.Error.WriteLine("INFO: Mixing and writing file...");
            MixAndWrite(outputPath, targetFormat, waveProviders, captures, micBuffer, micCapture?.WaveFormat);

            // Cleanup
            foreach (var c in captures) c.Dispose();
            micCapture?.Dispose();
            
            Console.Error.WriteLine($"INFO: Done!");
        }
        
        static void MixAndWrite(string outputPath, WaveFormat targetFormat,
            List<BufferedWaveProvider> waveProviders, List<WasapiLoopbackCapture> captures,
            BufferedWaveProvider? micBuffer, WaveFormat? micFormat)
        {
            var sampleProviders = new List<ISampleProvider>();
            
            // Add loopback sources
            for (int i = 0; i < waveProviders.Count; i++)
            {
                var provider = waveProviders[i];
                var capture = captures[i];
                
                if (provider.BufferedBytes > 0)
                {
                    var data = new byte[provider.BufferedBytes];
                    int read = provider.Read(data, 0, data.Length);
                    
                    if (read > 0)
                    {
                        var raw = new RawSourceWaveStream(new MemoryStream(data, 0, read), capture.WaveFormat);
                        var samples = raw.ToSampleProvider();
                        
                        if (capture.WaveFormat.SampleRate != targetFormat.SampleRate)
                            samples = new WdlResamplingSampleProvider(samples, targetFormat.SampleRate);
                        
                        if (capture.WaveFormat.Channels == 1)
                            samples = new MonoToStereoSampleProvider(samples);
                        else if (capture.WaveFormat.Channels > 2)
                            samples = new MultiplexingSampleProvider(new[] { samples }, 2);
                        
                        samples = new VolumeSampleProvider(samples) { Volume = 0.7f };
                        sampleProviders.Add(samples);
                        
                        Console.Error.WriteLine($"INFO: Added loopback source: {read / 1024} KB");
                    }
                }
            }
            
            // Add microphone
            if (micBuffer != null && micFormat != null && micBuffer.BufferedBytes > 0)
            {
                var data = new byte[micBuffer.BufferedBytes];
                int read = micBuffer.Read(data, 0, data.Length);
                
                if (read > 0)
                {
                    var raw = new RawSourceWaveStream(new MemoryStream(data, 0, read), micFormat);
                    var samples = raw.ToSampleProvider();
                    
                    if (micFormat.SampleRate != targetFormat.SampleRate)
                        samples = new WdlResamplingSampleProvider(samples, targetFormat.SampleRate);
                    
                    if (micFormat.Channels == 1)
                        samples = new MonoToStereoSampleProvider(samples);
                    
                    samples = new VolumeSampleProvider(samples) { Volume = 0.9f };
                    sampleProviders.Add(samples);
                    
                    Console.Error.WriteLine($"INFO: Added mic source: {read / 1024} KB");
                }
            }
            
            if (!sampleProviders.Any())
            {
                Console.Error.WriteLine("WARNING: No audio data!");
                using var empty = new WaveFileWriter(outputPath, new WaveFormat(48000, 16, 2));
                return;
            }
            
            // Mix all sources - DON'T use ReadFully to avoid infinite generation
            var mixer = new MixingSampleProvider(sampleProviders) { ReadFully = false };
            
            // Write to file with limited duration
            using (var writer = new WaveFileWriter(outputPath, new WaveFormat(48000, 16, 2)))
            {
                var buffer = new float[48000 * 2]; // 1 second buffer
                int samplesRead;
                long totalSamples = 0;
                long maxSamples = 48000 * 2 * 60 * 10; // Max 10 minutes
                
                while ((samplesRead = mixer.Read(buffer, 0, buffer.Length)) > 0 && totalSamples < maxSamples)
                {
                    // Convert float to 16-bit PCM
                    var pcmBuffer = new byte[samplesRead * 2];
                    for (int i = 0; i < samplesRead; i++)
                    {
                        var sample = Math.Clamp(buffer[i], -1f, 1f);
                        var pcm = (short)(sample * 32767);
                        pcmBuffer[i * 2] = (byte)(pcm & 0xFF);
                        pcmBuffer[i * 2 + 1] = (byte)((pcm >> 8) & 0xFF);
                    }
                    writer.Write(pcmBuffer, 0, pcmBuffer.Length);
                    totalSamples += samplesRead;
                }
            }
            
            var size = new FileInfo(outputPath).Length;
            var durationSec = size / (48000 * 2 * 2); // 48kHz, 16-bit, stereo
            Console.Error.WriteLine($"INFO: File: {size / 1024} KB, Duration: {durationSec} sec");
        }
    }
}
