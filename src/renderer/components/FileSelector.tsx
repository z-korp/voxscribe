import { normalizePath } from '../utils/format';

type FileSelectorProps = {
  selectedFiles: string[];
  onSelectFiles: () => Promise<void>;
};

export function FileSelector({ selectedFiles, onSelectFiles }: FileSelectorProps): JSX.Element {
  return (
    <section className="card">
      <header className="card__header">
        <h2>Files</h2>
        <p>Select audio or video files to analyze.</p>
      </header>
      <div className="card__body">
        <button className="btn btn-primary" onClick={onSelectFiles} type="button">
          Choose files...
        </button>
        {selectedFiles.length > 0 ? (
          <ul className="file-list">
            {selectedFiles.map((file) => (
              <li key={file} className="file-list__item">
                {normalizePath(file)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="placeholder">No files selected.</p>
        )}
      </div>
    </section>
  );
}
