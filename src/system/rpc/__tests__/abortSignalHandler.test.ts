import * as assert from 'assert';
import type { HandlerConnectionContext, ToWireContext } from '@eamodio/supertalk';
import { GlAbortSignalHandler } from '../abortSignalHandler.js';

const toWireCtx: ToWireContext = { toWire: (v: unknown) => v };

interface AnyWire {
	__st__: string;
	id: number;
	aborted: boolean;
	reason?: unknown;
}

suite('GlAbortSignalHandler Test Suite', () => {
	suite('canHandle', () => {
		test('returns true for AbortSignal instances', () => {
			const handler = new GlAbortSignalHandler();
			assert.strictEqual(handler.canHandle(new AbortController().signal), true);
			assert.strictEqual(handler.canHandle(AbortSignal.abort()), true);
		});

		test('returns false for non-AbortSignal values', () => {
			const handler = new GlAbortSignalHandler();
			assert.strictEqual(handler.canHandle({}), false);
			assert.strictEqual(handler.canHandle(null), false);
			assert.strictEqual(handler.canHandle(undefined), false);
			assert.strictEqual(handler.canHandle('aborted'), false);
		});
	});

	suite('toWire (already-aborted)', () => {
		test('default DOMException reason is wrapped in an envelope', () => {
			const handler = new GlAbortSignalHandler();
			const signal = AbortSignal.abort(); // default reason: DOMException("AbortError")

			const wire = handler.toWire(signal, toWireCtx) as AnyWire;

			assert.strictEqual(wire.aborted, true);
			assert.ok(wire.reason != null && typeof wire.reason === 'object');
			const reason = wire.reason as { __st__?: string; name?: string; message?: string };
			assert.strictEqual(reason.__st__, 'st-error');
			assert.strictEqual(reason.name, 'AbortError');
			assert.strictEqual(typeof reason.message, 'string');
		});

		test('Error reason preserves name and message', () => {
			const handler = new GlAbortSignalHandler();
			const signal = AbortSignal.abort(new Error('boom'));

			const wire = handler.toWire(signal, toWireCtx) as AnyWire;

			const reason = wire.reason as { __st__?: string; name?: string; message?: string };
			assert.strictEqual(reason.__st__, 'st-error');
			assert.strictEqual(reason.name, 'Error');
			assert.strictEqual(reason.message, 'boom');
		});

		test('TypeError subclass preserves the subclass name', () => {
			const handler = new GlAbortSignalHandler();
			const signal = AbortSignal.abort(new TypeError('bad'));

			const wire = handler.toWire(signal, toWireCtx) as AnyWire;
			const reason = wire.reason as { name?: string };
			assert.strictEqual(reason.name, 'TypeError');
		});

		test('string "completed" sentinel reason is not wrapped', () => {
			const handler = new GlAbortSignalHandler();
			const signal = AbortSignal.abort('completed');

			const wire = handler.toWire(signal, toWireCtx) as AnyWire;
			assert.strictEqual(wire.reason, 'completed');
		});

		test('plain-object reason without name/message is passed through', () => {
			const handler = new GlAbortSignalHandler();
			const reasonObj = { tag: 'cancelled' };
			const signal = AbortSignal.abort(reasonObj);

			const wire = handler.toWire(signal, toWireCtx) as AnyWire;
			assert.deepStrictEqual(wire.reason, { tag: 'cancelled' });
		});

		test('null reason is passed through', () => {
			const handler = new GlAbortSignalHandler();
			const signal = AbortSignal.abort(null);

			const wire = handler.toWire(signal, toWireCtx) as AnyWire;
			assert.strictEqual(wire.reason, null);
		});
	});

	suite('toWire (not-yet-aborted)', () => {
		test('wire has aborted=false and no reason', () => {
			const handler = new GlAbortSignalHandler();
			const controller = new AbortController();

			const wire = handler.toWire(controller.signal, toWireCtx) as AnyWire;
			assert.strictEqual(wire.aborted, false);
			assert.strictEqual(wire.reason, undefined);
		});
	});

	suite('round-trip via fromWire', () => {
		test('default DOMException reason reconstructs as DOMException with AbortError', () => {
			// Sender side
			const sender = new GlAbortSignalHandler();
			const wire = sender.toWire(AbortSignal.abort(), toWireCtx) as AnyWire;

			// Receiver side
			const receiver = new GlAbortSignalHandler();
			const signal = receiver.fromWire(wire as never);

			assert.strictEqual(signal.aborted, true);
			assert.ok(signal.reason instanceof DOMException);
			assert.strictEqual(signal.reason.name, 'AbortError');
		});

		test('Error reason reconstructs as Error with original name/message', () => {
			const sender = new GlAbortSignalHandler();
			const wire = sender.toWire(AbortSignal.abort(new Error('boom')), toWireCtx) as AnyWire;

			const receiver = new GlAbortSignalHandler();
			const signal = receiver.fromWire(wire as never);

			assert.strictEqual(signal.aborted, true);
			assert.ok(signal.reason instanceof Error);
			assert.strictEqual(signal.reason.name, 'Error');
			assert.strictEqual(signal.reason.message, 'boom');
		});

		test('TypeError reason reconstructs with name preserved', () => {
			const sender = new GlAbortSignalHandler();
			const wire = sender.toWire(AbortSignal.abort(new TypeError('bad')), toWireCtx) as AnyWire;

			const receiver = new GlAbortSignalHandler();
			const signal = receiver.fromWire(wire as never);

			assert.ok(signal.reason instanceof Error);
			assert.strictEqual(signal.reason.name, 'TypeError');
			assert.strictEqual(signal.reason.message, 'bad');
		});

		test('string "completed" reason round-trips unchanged', () => {
			const sender = new GlAbortSignalHandler();
			const wire = sender.toWire(AbortSignal.abort('completed'), toWireCtx) as AnyWire;

			const receiver = new GlAbortSignalHandler();
			const signal = receiver.fromWire(wire as never);

			assert.strictEqual(signal.aborted, true);
			assert.strictEqual(signal.reason, 'completed');
		});

		test('plain-object reason round-trips unchanged', () => {
			const sender = new GlAbortSignalHandler();
			const wire = sender.toWire(AbortSignal.abort({ tag: 'cancelled' }), toWireCtx) as AnyWire;

			const receiver = new GlAbortSignalHandler();
			const signal = receiver.fromWire(wire as never);

			assert.deepStrictEqual(signal.reason, { tag: 'cancelled' });
		});

		test('not-yet-aborted signal is reconstructed as a non-aborted signal', () => {
			const sender = new GlAbortSignalHandler();
			const controller = new AbortController();
			const wire = sender.toWire(controller.signal, toWireCtx) as AnyWire;

			const receiver = new GlAbortSignalHandler();
			const signal = receiver.fromWire(wire as never);

			assert.strictEqual(signal.aborted, false);
		});
	});

	suite('connect / runtime abort listener', () => {
		test('wraps ctx.sendMessage to serialize abort reasons emitted by the parent listener', () => {
			const sender = new GlAbortSignalHandler();
			const sentMessages: unknown[] = [];
			const ctx: HandlerConnectionContext = {
				sendMessage: (payload: unknown) => sentMessages.push(payload),
			};
			sender.connect(ctx);

			// Register a not-yet-aborted signal so the parent installs its abort listener
			const controller = new AbortController();
			sender.toWire(controller.signal, toWireCtx);

			// Trigger the listener
			controller.abort();

			// Find the abort message (parent may emit other internal messages too)
			const abortMessage = sentMessages.find(
				(m): m is { type: string; id: number; reason?: unknown } =>
					m != null && typeof m === 'object' && (m as { type?: unknown }).type === 'abort',
			);
			assert.ok(abortMessage, 'expected an abort message to be emitted');

			const reason = abortMessage.reason as { __st__?: string; name?: string; message?: string } | undefined;
			assert.ok(reason != null && typeof reason === 'object', 'reason should be an envelope object');
			assert.strictEqual(reason.__st__, 'st-error');
			assert.strictEqual(reason.name, 'AbortError');
		});

		test('release messages (controller.abort("completed")) are not wrapped', () => {
			const sender = new GlAbortSignalHandler();
			const sentMessages: unknown[] = [];
			sender.connect({ sendMessage: (payload: unknown) => sentMessages.push(payload) });

			const controller = new AbortController();
			sender.toWire(controller.signal, toWireCtx);
			controller.abort('completed');

			const releaseMessage = sentMessages.find(
				(m): m is { type: string } =>
					m != null && typeof m === 'object' && (m as { type?: unknown }).type === 'release',
			);
			assert.ok(releaseMessage, 'expected a release message instead of abort for the COMPLETED sentinel');
		});
	});

	suite('onMessage', () => {
		test('deserializes serialized abort reason and aborts the local controller with a real DOMException', () => {
			const receiver = new GlAbortSignalHandler();

			// Establish a controller for id=42 by deserializing a not-yet-aborted wire
			const wire: AnyWire = { __st__: 'abort-signal', id: 42, aborted: false };
			const signal = receiver.fromWire(wire as never);

			// Simulate an inbound abort message with a serialized envelope
			const message = {
				type: 'abort' as const,
				id: 42,
				reason: { __st__: 'st-error', name: 'AbortError', message: 'cancelled' },
			};
			receiver.onMessage(message);

			assert.strictEqual(signal.aborted, true);
			assert.ok(signal.reason instanceof DOMException);
			assert.strictEqual(signal.reason.name, 'AbortError');
			assert.strictEqual(signal.reason.message, 'cancelled');
		});

		test('passes through abort messages whose reason is not an envelope', () => {
			const receiver = new GlAbortSignalHandler();
			const wire: AnyWire = { __st__: 'abort-signal', id: 7, aborted: false };
			const signal = receiver.fromWire(wire as never);

			receiver.onMessage({ type: 'abort', id: 7, reason: 'completed' });

			assert.strictEqual(signal.aborted, true);
			assert.strictEqual(signal.reason, 'completed');
		});
	});
});
