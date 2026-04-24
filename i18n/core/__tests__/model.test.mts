import assert from 'node:assert/strict';

import { hasTranslation, type WorksetMessageRecord } from '../model.mts';

run();

function run(): void {
	testEmptyTranslationIsNotAccepted();
	testTemplateWithAllSlotsIsAccepted();
}

function testEmptyTranslationIsNotAccepted(): void {
	const record: WorksetMessageRecord = {
		id: 'message.empty',
		kind: 'literal',
		source: ' more ',
		translation: '',
	};

	assert.equal(hasTranslation(record), false);
}

function testTemplateWithAllSlotsIsAccepted(): void {
	const record: WorksetMessageRecord = {
		id: 'message.valid-template',
		kind: 'template',
		source: '${slot1} on ${slot2}',
		translation: '在 ${slot2} 上打开 ${slot1}',
		slots: ['slot1', 'slot2'],
	};

	assert.equal(hasTranslation(record), true);
}
