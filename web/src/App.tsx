import { useState } from 'react';
import type { ItemDto, Settings, TrashResponse } from '../../src/shared/api';
import { api, errorMessage } from './api/client';
import { BottomBar } from './components/BottomBar';
import { HeroView } from './components/HeroView';
import { ResultsHeader } from './components/ResultsHeader';
import { ResultsTable } from './components/ResultsTable';
import { ScanningView } from './components/ScanningView';
import { SettingsDialog } from './components/SettingsDialog';
import { Sidebar } from './components/Sidebar';
import { ConfirmTrashDialog, TrashSummaryDialog } from './components/TrashDialogs';
import { UnreadableBanner } from './components/UnreadableBanner';
import { UpdateBanner } from './components/UpdateBanner';
import { formatBytes } from './format';
import { useAppInfo } from './hooks/useAppInfo';
import { useEcosystems } from './hooks/useEcosystems';
import { useFolder } from './hooks/useFolder';
import { useResults } from './hooks/useResults';
import { useScan } from './hooks/useScan';
import { useSettings } from './hooks/useSettings';
import { useTrash } from './hooks/useTrash';
import { useUpdate } from './hooks/useUpdate';
import styles from './App.module.css';

const NO_ITEMS: ItemDto[] = [];
const MB = 1000 * 1000;

function describeFilters(settings: Settings | null): string {
  if (!settings) return '';
  const size = `at least ${formatBytes(settings.minSizeMB * MB)}`;
  return settings.includeRecentProjects
    ? `No matching folders ${size}.`
    : `No matching folders ${size} in projects inactive for ${settings.minProjectAgeDays}+ days. You can change this in Settings.`;
}

export function App() {
  const settingsState = useSettings();
  const { settings } = settingsState;
  const folderState = useFolder(settings === null ? undefined : settings.lastFolder);
  const scanState = useScan();
  const { scan } = scanState;
  const items = scan?.status === 'done' ? scan.items : NO_ITEMS;
  const results = useResults(items);
  const trashState = useTrash();
  const appInfoState = useAppInfo();
  const ecosystemState = useEcosystems();
  const updateState = useUpdate();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [trashResult, setTrashResult] = useState<TrashResponse | null>(null);
  const [dismissedBannerFor, setDismissedBannerFor] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const scanning = scan?.status === 'running';
  const busy = scanState.starting || folderState.picking || trashState.busy;
  const canScan = !scanning && !busy && folderState.folder.trim() !== '';
  const startScan = () => void scanState.start(folderState.folder);

  const reveal = (id: string) => {
    setActionError(null);
    api.reveal(id).catch((err: unknown) => setActionError(errorMessage(err)));
  };

  const confirmTrash = async () => {
    setConfirmOpen(false);
    const result = await trashState.trash(results.checkedItems.map((item) => item.id));
    if (!result || !scan) return;
    setTrashResult(result);
    void scanState.start(scan.root);
  };

  const error = settingsState.error ?? appInfoState.error ?? folderState.error ?? scanState.error ?? trashState.error ?? actionError ?? null;

  const renderContent = () => {
    if (!scan) {
      return (
        <HeroView
          title="Find forgotten dev junk"
          subtitle="Scan a folder for node_modules, build outputs and virtualenvs from projects you haven't touched in a while. Nothing is removed until you confirm."
          folder={folderState.folder}
          disabled={!canScan}
          onScan={startScan}
        />
      );
    }
    if (scanning) return <ScanningView progress={scan.progress} onCancel={() => void scanState.cancel()} />;
    if (scan.status === 'cancelled') {
      return <HeroView title="Scan cancelled" subtitle="Start again whenever you're ready." folder={scan.root} disabled={!canScan} onScan={startScan} />;
    }
    if (scan.status === 'failed') {
      return <HeroView title="Scan failed" subtitle={scan.error ?? 'Something went wrong.'} folder={scan.root} buttonLabel="Retry" disabled={!canScan} onScan={startScan} />;
    }
    if (items.length === 0) {
      return <HeroView title="All clean" subtitle={describeFilters(settings)} folder={scan.root} buttonLabel="Rescan" disabled={!canScan} onScan={startScan} />;
    }
    return (
      <>
        <ResultsHeader root={scan.root} count={items.length} totalBytes={results.totalBytes} disabled={!canScan} onRescan={startScan} />
        <ResultsTable
          root={scan.root}
          items={results.sorted}
          checked={results.checked}
          sortOrder={results.sortOrder}
          onSort={results.sortBy}
          onToggle={results.toggle}
          onToggleAll={results.setAll}
          onReveal={reveal}
        />
        <BottomBar
          totalCount={items.length}
          checkedCount={results.checkedItems.length}
          checkedBytes={results.checkedBytes}
          busy={trashState.busy}
          onTrash={() => setConfirmOpen(true)}
        />
      </>
    );
  };

  return (
    <div className={styles.app}>
      <Sidebar
        folder={folderState.folder}
        locked={scanning}
        busy={busy}
        breakdown={results.breakdown}
        onFolderChange={folderState.setFolder}
        onChooseFolder={() => void folderState.choose()}
        onScan={startScan}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <main className={styles.main}>
        <div className={styles.dragRegion} aria-hidden="true" />
        {updateState.update && (
          <UpdateBanner update={updateState.update} onDownload={updateState.open} onDismiss={updateState.dismiss} />
        )}
        {error && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}
        {scan?.status === 'done' && scan.unreadableCount > 0 && dismissedBannerFor !== scan.id && (
          <UnreadableBanner count={scan.unreadableCount} sample={scan.unreadableSample} onDismiss={() => setDismissedBannerFor(scan.id)} />
        )}
        {renderContent()}
      </main>

      {settings && (
        <SettingsDialog
          open={settingsOpen}
          settings={settings}
          appInfo={appInfoState.info}
          ecosystems={ecosystemState.ecosystems}
          ecosystemsError={ecosystemState.error}
          onSave={settingsState.save}
          onSetOpenAtLogin={appInfoState.setOpenAtLogin}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      <ConfirmTrashDialog
        open={confirmOpen}
        count={results.checkedItems.length}
        bytes={results.checkedBytes}
        onConfirm={() => void confirmTrash()}
        onCancel={() => setConfirmOpen(false)}
      />
      <TrashSummaryDialog result={trashResult} onClose={() => setTrashResult(null)} />
    </div>
  );
}
