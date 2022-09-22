import "mocha";
import { configureStore, createAction, createReducer } from '@reduxjs/toolkit';
import { expect } from "chai";
import { Subject } from "rxjs";
import { Constructor, createWatcher, Updatable } from "./createWatcher";

// Push action
const pushAction = createAction<string>('push');

// Create redux store
const getStore = () => configureStore({
    reducer: {
        slice: createReducer<string[]>(
            // Default state
            [],

            // Build reducer
            (builder) => {
                builder.addCase(pushAction, (state, action) => {
                    state.push(action.payload);
                });
            }
        ),
    },
})

describe("Compatibility", () => {
    describe("with redux store", () => {
        let store: ReturnType<typeof getStore>;
        let watch: ReturnType<typeof createWatcher<typeof store>>;
        let mount: Constructor<Updatable & {
            entireStore: ReturnType<typeof store.getState>;
            slice: string[];
            second?: string;
        }>;

        beforeEach(() => {
            // Create store
            store = getStore();

            // Create watcher
            watch = createWatcher(store);

            // Create class
            class Mount implements Updatable {
                @watch()
                public entireStore!: ReturnType<typeof store.getState>;

                @watch((state) => state.slice)
                public slice!: string[];

                @watch((state) => state.slice[1])
                public second?: string;

                constructor() {
                    this.connectedCallback();
                }

                public connectedCallback(): void {}
                public disconnectedCallback(): void {}

                public requestUpdate(_name?: PropertyKey | undefined, _oldValue?: unknown): void {}
            }
            mount = Mount;
        });

        it("should set initial values on construction", () => {
            // Construct instance
            const instance = new mount();

            expect(instance.entireStore).to.be.deep.equal({ slice: [] });
            expect(instance.slice).to.be.deep.equal([]);
            expect(instance.second).to.be.undefined;
        });

        it("should get updates", () => {
            // Construct instance
            const instance = new mount();

            expect(instance.entireStore).to.be.deep.equal({ slice: [] });
            expect(instance.slice).to.be.deep.equal([]);
            expect(instance.second).to.be.undefined;

            let calls: any[] = []
            instance.requestUpdate = (...args) => {
                calls.push(args);
            }

            store.dispatch(pushAction('new_value'));

            expect(calls).to.deep.includes(['entireStore', { slice: [] }]);
            expect(calls).to.deep.includes(['slice', []]);
            
            expect(instance.entireStore).to.be.deep.equal({ slice: ['new_value'] });
            expect(instance.slice).to.be.deep.equal(['new_value']);
            expect(instance.second).to.be.undefined;

            calls = [];

            store.dispatch(pushAction('always_this_late'));

            expect(calls).to.deep.includes(['entireStore', { slice: ['new_value'] }]);
            expect(calls).to.deep.includes(['slice', ['new_value']]);
            expect(calls).to.deep.includes(['second', undefined]);

            expect(instance.entireStore).to.be.deep.equal({ slice: ['new_value', 'always_this_late'] });
            expect(instance.slice).to.be.deep.equal(['new_value', 'always_this_late']);
            expect(instance.second).to.be.equal('always_this_late');
        });
    });

    describe("with RxJS Observable", () => {
        let observable: Subject<{ value: string }>;
        let observe: ReturnType<typeof createWatcher<typeof observable>>;
        let mount: Constructor<Updatable & {
            complete?: { value: string };
            single?: string;
        }>;

        beforeEach(() => {
            // Create observable
            observable = new Subject<{ value: string }>();

            // Create watcher
            observe = createWatcher(observable);

            // Create class
            class Mount implements Updatable {
                @observe()
                public complete?: { value: string };

                @observe((state) => state.value)
                public single?: string;

                constructor() {
                    this.connectedCallback();
                }

                public connectedCallback(): void {}
                public disconnectedCallback(): void {}

                public requestUpdate(_name?: PropertyKey | undefined, _oldValue?: unknown): void {}
            }
            mount = Mount;
        });

        it("without emit should return undefined", () => {
            const instance = new mount();

            expect(instance.complete).to.be.undefined;
            expect(instance.single).to.be.undefined;
        });

        it("with pre-emit should load existing value", () => {
            observable.next({ value: 'pre_emit' });

            const instance = new mount();

            expect(instance.complete).to.deep.equal({ value: 'pre_emit' });
            expect(instance.single).to.equal('pre_emit');
        });

        it("with post-emit should have new value", () => {
            const instance = new mount();

            observable.next({ value: 'post_emit' });

            expect(instance.complete).to.deep.equal({ value: 'post_emit' });
            expect(instance.single).to.equal('post_emit');
        });

        it("should get updates on emits", () => {
            // Construct instance
            const instance = new mount();

            expect(instance.complete).to.be.undefined;
            expect(instance.single).to.be.undefined;

            let calls: any[] = []
            instance.requestUpdate = (...args) => {
                calls.push(args);
            }

            observable.next({ value: 'one_for_the_money' });

            expect(calls).to.deep.includes(['complete', undefined]);
            expect(calls).to.deep.includes(['single', undefined]);
            
            expect(instance.complete).to.be.deep.equal({ value: 'one_for_the_money' });
            expect(instance.single).to.be.deep.equal('one_for_the_money');

            calls = [];

            observable.next({ value: 'two_for_the_show' });

            expect(calls).to.deep.includes(['complete', { value: 'one_for_the_money' }]);
            expect(calls).to.deep.includes(['single', 'one_for_the_money']);
            
            expect(instance.complete).to.be.deep.equal({ value: 'two_for_the_show' });
            expect(instance.single).to.be.deep.equal('two_for_the_show');
        });



        it("should not get updates after disconnectedCallback was called", () => {
            // Construct instance
            const instance = new mount();

            expect(instance.complete).to.be.undefined;
            expect(instance.single).to.be.undefined;

            let calls: any[] = []
            instance.requestUpdate = (...args) => {
                calls.push(args);
            }

            observable.next({ value: 'one_for_the_money' });

            expect(calls).to.deep.includes(['complete', undefined]);
            expect(calls).to.deep.includes(['single', undefined]);
            
            expect(instance.complete).to.be.deep.equal({ value: 'one_for_the_money' });
            expect(instance.single).to.be.deep.equal('one_for_the_money');

            instance.disconnectedCallback();

            calls = [];

            observable.next({ value: 'two_for_the_show' });

            expect(calls).to.deep.equals([]);
            
            expect(instance.complete).to.be.deep.equal({ value: 'two_for_the_show' });
            expect(instance.single).to.be.deep.equal('two_for_the_show');
        });
    });
});
