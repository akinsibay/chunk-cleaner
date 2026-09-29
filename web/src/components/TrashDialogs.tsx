import type { TrashResponse } from '../../../src/shared/api';
import { formatBytes, pluralize } from '../format';
import { Button } from './Button';
import { Modal } from './Modal';
import styles from './TrashDialogs.module.css';

interface ConfirmTrashDialogProps {
  open: boolean;
  count: number;
  bytes: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmTrashDialog({ open, count, bytes, onConfirm, onCancel }: ConfirmTrashDialogProps) {
  return (
    <Modal
      open={open}
      title="Move to Trash?"
      onClose={onCancel}
      actions={
        <>
          <Button onClick={onCancel} autoFocus>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            Move to Trash
          </Button>
        </>
      }
    >
      <p>
        {pluralize(count, 'folder')} ({formatBytes(bytes)}) will be moved to the Trash.
      </p>
      <p className={styles.note}>Each folder is checked again right before it is moved. You can restore them from the Trash.</p>
    </Modal>
  );
}

interface TrashSummaryDialogProps {
  result: TrashResponse | null;
  onClose: () => void;
}

export function TrashSummaryDialog({ result, onClose }: TrashSummaryDialogProps) {
  return (
    <Modal
      open={result !== null}
      title="Done"
      onClose={onClose}
      actions={
        <Button variant="primary" onClick={onClose} autoFocus>
          OK
        </Button>
      }
    >
      {result && (
        <>
          <p>
            Freed {formatBytes(result.freedBytes)} from {pluralize(result.trashedCount, 'folder')}.
          </p>
          {result.failures.length > 0 && (
            <>
              <p>{pluralize(result.failures.length, 'folder was', 'folders were')} skipped:</p>
              <ul className={styles.failures}>
                {result.failures.map((failure) => (
                  <li key={failure.path}>
                    <span className={styles.failurePath}>{failure.path}</span> — {failure.reason}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
