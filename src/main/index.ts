import * as electron from 'electron';
const { app, BrowserWindow, desktopCapturer, dialog, ipcMain, shell } = electron;
import fs from 'node:fs';
import path from 'node:path';
import archiver from 'archiver';
import {
  MediaChunkService,
  type MediaAnalysisRequest,
  type MediaAnalysisResponse,
} from './media-chunker';

if (process.env['WSL_DISTRO_NAME']) {
  app.disableHardwareAcceleration();
}

// Check if running in development
const isDevelopment = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;
const mediaService = new MediaChunkService();

async function zipDirectory(sourceDir: string, outPath: string): Promise<void> {
  await fs.promises.mkdir(path.dirname(outPath), { recursive: true });

  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(outPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve());
    output.on('error', reject);
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(sourceDir, false);
    void archive.finalize();
  });
}

async function createWindow(): Promise<BrowserWindow> {
  const preloadPath = path.join(__dirname, '../preload/index.js');
  if (!fs.existsSync(preloadPath)) {
    console.error('Preload script not found at', preloadPath);
  }

  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.on('ready-to-show', () => {
    window.show();
  });

  // Watch for window shortcuts in development
  if (isDevelopment) {
    window.webContents.on('before-input-event', (_, input) => {
      if (input.key === 'F12' && input.type === 'keyDown') {
        window.webContents.toggleDevTools();
      }
    });
  }

  window.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (isDevelopment && process.env['ELECTRON_RENDERER_URL']) {
    await window.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    await window.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  }

  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });

  mainWindow = window;
  return window;
}

app.whenReady().then(() => {
  // Set app user model ID for Windows
  if (process.platform === 'win32') {
    app.setAppUserModelId(process.execPath);
  }

  void createWindow().then((window) => {
    mainWindow = window ?? mainWindow;
  });
});

ipcMain.handle('system:ping', async () => {
  return 'pong';
});

ipcMain.handle('media:get-default-options', async () => {
  return mediaService.getDefaultOptions();
});

ipcMain.handle('media:get-default-transcription', async () => {
  return mediaService.getDefaultTranscriptionOptions();
});

ipcMain.handle(
  'media:select-sources',
  async (
    _,
    options: {
      allowMultiple?: boolean;
      filters?: Electron.FileFilter[];
      defaultPath?: string;
    } = {},
  ) => {
    const { allowMultiple = true, filters, defaultPath } = options;
    const result = await dialog.showOpenDialog({
      title: 'Sélectionner des enregistrements',
      defaultPath,
      filters: filters ?? [
        {
          name: 'Audio & Vidéo',
          extensions: ['wav', 'mp3', 'm4a', 'ogg', 'webm', 'mp4', 'mkv', 'mov', 'avi'],
        },
      ],
      properties: allowMultiple ? ['openFile', 'multiSelections'] : ['openFile'],
    });

    return {
      canceled: result.canceled,
      filePaths: result.filePaths,
    };
  },
);

ipcMain.handle('media:analyze', async (_, request: MediaAnalysisRequest) => {
  const outputDir =
    request?.outputDir && request.outputDir.trim().length > 0
      ? request.outputDir
      : path.join(app.getPath('userData'), 'media-previews');

  const response: MediaAnalysisResponse = await mediaService.analyze({
    ...request,
    outputDir,
  });
  return response;
});

ipcMain.handle('media:open-path', async (_, targetPath: string) => {
  if (!targetPath || typeof targetPath !== 'string') {
    throw new Error('Chemin invalide.');
  }

  const resolved = path.resolve(targetPath);
  const previewsRoot = path.join(app.getPath('userData'), 'media-previews');
  const normalizedRoot = path.normalize(previewsRoot + path.sep);
  const normalizedTarget = path.normalize(resolved);

  if (!normalizedTarget.startsWith(normalizedRoot)) {
    throw new Error("Accès refusé : chemin en dehors du dossier d'export.");
  }

  const errorMessage = await shell.openPath(normalizedTarget);
  if (errorMessage) {
    throw new Error(`Impossible d'ouvrir le chemin : ${errorMessage}`);
  }

  return { success: true };
});

ipcMain.handle('media:zip-chunks', async (_, targetDir: string) => {
  if (!targetDir || typeof targetDir !== 'string') {
    throw new Error('Chemin de dossier invalide.');
  }

  const resolved = path.resolve(targetDir);
  const previewsRoot = path.join(app.getPath('userData'), 'media-previews');
  const normalizedRoot = path.normalize(previewsRoot + path.sep);
  const normalizedTarget = path.normalize(resolved);

  if (!normalizedTarget.startsWith(normalizedRoot)) {
    throw new Error("Accès refusé : dossier en dehors du répertoire d'export.");
  }

  const defaultName = `${path.basename(normalizedTarget)}.zip`;
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Enregistrer les chunks (ZIP)',
    defaultPath: defaultName,
    filters: [{ name: 'Archive ZIP', extensions: ['zip'] }],
  });

  if (canceled || !filePath) {
    return { canceled: true };
  }

  await zipDirectory(normalizedTarget, filePath);

  return { canceled: false, filePath };
});

ipcMain.handle('recording:get-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 150, height: 150 },
  });

  return sources.map((source) => ({
    id: source.id,
    name: source.name,
    thumbnail: source.thumbnail.toDataURL(),
  }));
});

ipcMain.handle(
  'recording:save',
  async (
    _,
    options: {
      buffer: ArrayBuffer;
      filename?: string;
    },
  ) => {
    const recordingsDir = path.join(app.getPath('userData'), 'recordings');
    await fs.promises.mkdir(recordingsDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = options.filename ?? `meeting-${timestamp}.webm`;
    const filePath = path.join(recordingsDir, filename);

    await fs.promises.writeFile(filePath, Buffer.from(options.buffer));

    return {
      filePath,
      fileUrl: `file://${filePath}`,
    };
  },
);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  }
});
