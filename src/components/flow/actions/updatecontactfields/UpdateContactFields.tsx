import { getLanguageForCode } from 'components/flow/actions/updatecontact/helpers';
import { renderSetText } from 'components/flow/actions/updatecontact/UpdateContact';
import { ContactFieldEntry, ContactProperties, SetContactFields } from 'flowTypes';
import * as React from 'react';
import { AssetMap } from 'store/flowContext';

import styles from './UpdateContactFields.module.scss';

export const MAX_TO_SHOW = 5;

/** The language row stores an iso code, so show the language name the author picked */
const entryValue = (entry: ContactFieldEntry, languages: AssetMap): string =>
  entry.type === ContactProperties.Language
    ? getLanguageForCode(entry.value, languages)
    : entry.value;

const UpdateContactFieldsComp: React.SFC<SetContactFields> = (
  action: SetContactFields
): JSX.Element => {
  const fields = action.fields || [];

  if (!fields.length) {
    return null;
  }

  const shown = fields.slice(0, MAX_TO_SHOW);
  const remaining = fields.length - shown.length;
  const languages = (action as any).languages;

  return (
    <div className={styles.fields}>
      {shown.map((entry, index) => (
        <div className={styles.field} key={`${entry.field.key}-${index}`}>
          {renderSetText(entry.field.name, entryValue(entry, languages), true)}
        </div>
      ))}
      {remaining > 0 ? <div className={styles.more}>+{remaining} more</div> : null}
    </div>
  );
};

export default UpdateContactFieldsComp;
