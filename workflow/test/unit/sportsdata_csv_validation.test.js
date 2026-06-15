import { describe, expect, it } from 'vitest';

import {
  validateCsvHeaders,
  validateCsvTextHeaders,
} from '../../../assets/js/sportsdata.js';

const trackingRules = {
  allowExtraColumns: false,
  delimiter: ',',
  columns: [
    { name: 'frameId', required: true },
    { name: 'swimmerId', required: true },
    { name: 'swimmerName', required: true },
  ],
};

describe('sportsdata CSV header validation', () => {
  it('accepts headers declared by the rules', () => {
    const issues = validateCsvHeaders(['frameId', 'swimmerId', 'swimmerName'], trackingRules);

    expect(issues).toEqual([]);
  });

  it('reports missing and unknown headers like sportsdata rules', () => {
    const issues = validateCsvHeaders(['frameId', 'swimmerId', 'unexpected'], trackingRules);

    expect(issues.map((issue) => issue.message)).toEqual([
      "missing required column 'swimmerName'",
      "unknown column 'unexpected'",
    ]);
  });

  it('parses the first CSV row before validating headers', () => {
    const result = validateCsvTextHeaders('frameId,swimmerId,swimmerName\n1,2,Ada', trackingRules);

    expect(result.headers).toEqual(['frameId', 'swimmerId', 'swimmerName']);
    expect(result.issues).toEqual([]);
  });
});
