import {
  getClearPlaceholder,
  getSavePlaceholder
} from 'components/flow/actions/setrunresult/SetRunResult';
import { RunResultEntry, SetRunResults } from 'flowTypes';
import * as React from 'react';

import styles from './SetRunResults.module.scss';

export const MAX_TO_SHOW = 5;

/** An empty value clears the result, exactly as it does on the single result node */
const entryPlaceholder = (entry: RunResultEntry): JSX.Element =>
  entry.value ? getSavePlaceholder(entry.value, entry.name) : getClearPlaceholder(entry.name);

const SetRunResultsComp: React.SFC<SetRunResults> = (action: SetRunResults): JSX.Element => {
  const results = action.results || [];

  if (!results.length) {
    return null;
  }

  const shown = results.slice(0, MAX_TO_SHOW);
  const remaining = results.length - shown.length;

  return (
    <div className={styles.results}>
      {shown.map((entry, index) => (
        <div className={styles.result} key={`${entry.name}-${index}`}>
          {entryPlaceholder(entry)}
        </div>
      ))}
      {remaining > 0 ? <div className={styles.more}>+{remaining} more</div> : null}
    </div>
  );
};

export default SetRunResultsComp;
