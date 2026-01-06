import { normalizePath } from '../utils/format';

type FileSelectorProps = {
  selectedFiles: string[];
  onSelectFiles: () => Promise<void>;
};

export function FileSelector({ selectedFiles, onSelectFiles }: FileSelectorProps): JSX.Element {
  return (
    <section className="card">
      <header className="card__header">
        <h2>Selection</h2>
        <p>Ajoutez vos enregistrements audio ou video.</p>
      </header>
      <div className="card__body">
        <button className="btn btn-primary" onClick={onSelectFiles} type="button">
          Choisir des fichiers...
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
          <p className="placeholder">Aucun fichier selectionne.</p>
        )}
      </div>
    </section>
  );
}
