import { RecordingControls } from './RecordingControls';
import styles from './Popup.module.css';

export function Popup() {
  return (
    <div className={styles['popup']}>
      <header className={styles['header']}>
        <div className={styles['brand']}>
          <span className={styles['brandLogo']}>C</span>
          <span className={styles['brandName']}>CHIRPY</span>
        </div>
      </header>

      <main className={styles['main']}>
        <section>
          <h2 className={styles['sectionTitle']}>Meeting Recording</h2>
          <RecordingControls />
        </section>

        <p className={styles['hint']}>
          Open Google Meet and join a meeting to start tracking participation.
        </p>
      </main>
    </div>
  );
}
