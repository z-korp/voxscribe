import { fileNameFromPath } from '../utils/format';

type FileSelectorProps = {
  selectedFiles: string[];
  onSelectFiles: () => Promise<void>;
  onRemoveFile: (file: string) => void;
};

export function FileSelector({
  selectedFiles,
  onSelectFiles,
  onRemoveFile,
}: FileSelectorProps): JSX.Element {
  return (
    <section className="card">
      <header className="card__header">
        <h2>Files</h2>
      </header>
      <div className="card__body">
        <div className="file-tiles">
          {selectedFiles.map((file) => (
            <div key={file} className="file-tile">
              <span className="file-tile__name">{fileNameFromPath(file)}</span>
              <button
                className="file-tile__remove"
                type="button"
                onClick={() => onRemoveFile(file)}
                aria-label="Remove file"
              >
                &times;
              </button>
            </div>
          ))}
          <button className="file-tile file-tile--add" onClick={onSelectFiles} type="button">
            + Add files
          </button>
        </div>
      </div>
    </section>
  );
}
