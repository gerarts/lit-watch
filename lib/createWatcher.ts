/* eslint-disable
    @typescript-eslint/ban-types,
    @typescript-eslint/no-this-alias,
    @typescript-eslint/no-explicit-any,
*/
import { from, ObservableInput, ObservedValueOf } from 'rxjs';

/**
 * Abstract version of a partial ReactiveElement
 * 
 * This is mostly for internal use by this package, but it can be used as a base-class when you want to receive updates
 * in a non-HTMLElement type class.
 * 
 * Example
 * 
 * ```ts
 * class MyClass extends Updatable {}
 * ```
 * 
 * or
 * 
 * ```ts
 * class MyClass extends SomeOtherClass implements Updatable {}
 * ```
 */
export abstract class Updatable {
    public abstract connectedCallback(): void;
    public abstract disconnectedCallback(): void;
    public abstract requestUpdate(name?: PropertyKey, oldValue?: unknown): void;
}

/**
 * Create constructable type
 */
export type Constructor<T> = new (...args: any[]) => T;

/**
 * From the TC39 Decorators proposal
 */
export interface ClassDescriptor {
    kind: 'class';
    elements: ClassElement[];
    finisher?: <T>(clazz: Constructor<T>) => void | Constructor<T>;
}

/**
 * From the TC39 Decorators proposal
 */
export interface ClassElement {
    kind: 'field' | 'method';
    key: PropertyKey;
    placement: 'static' | 'prototype' | 'own';
    initializer?: Function;
    extras?: ClassElement[];
    finisher?: <T>(clazz: Constructor<T>) => void | Constructor<T>;
    descriptor?: PropertyDescriptor;
}

/**
 * Get keys from T where type of T[key] = V
 */
export type KeysFromObjectForType<T, V> = { [K in keyof T]-?: V extends T[K] ? K : never }[keyof T];

/**
 * Create a decorator that updates a property when an Observable updates and notifies LitElement / ReactiveElement.
 *
 * @param observable - The Observable to watch for updates
 * @returns - A decorator to create an updating property
 */
export function createWatcher<O extends ObservableInput<any>>(observable: O) {
    // Decorator generator function - i.e. @decorator(options)
    return function watchDecoratorGenerator<F extends (value: ObservedValueOf<O>) => any>(selector?: F) {
        // Decorator
        return function watchDecorator<T extends Updatable>(
            target: ClassElement | T,
            propertyKey?: KeysFromObjectForType<T, ReturnType<F> | undefined>,
        ): any {
            // Create a subscibe / unsubscribe mechanism to send updates to individual components
            let subscribers: ((prev: ReturnType<F>) => void)[] = [];
            function subscribe(subscriber: (prev: ReturnType<F>) => void) {
                subscribers.push(subscriber);

                return () => {
                    subscribers = subscribers.filter((item) => item !== subscriber);
                };
            }

            // Handle decorator use without selector
            const maybeSelector = selector ?? ((value) => value);

            let currentValue: ReturnType<F>;
            let thunk: (() => void) | undefined;

            // Get updates from observable and pass to subscribers
            from(observable).subscribe((value: ObservedValueOf<O>) => {
                // If there are no subscribers, create a thunk from the current value and selector to prevent unnecessary calculations
                if (subscribers.length === 0) {
                    thunk = () => {
                        currentValue = maybeSelector(value);
                        thunk = undefined;
                    };

                    return;
                }

                const nextValue = maybeSelector(value);
                if (currentValue !== nextValue) {
                    // Keep previous value for requestUpdate('key', previousValue)
                    const previousValue = currentValue;

                    // Set next value
                    currentValue = nextValue;

                    // Inform subscribers
                    subscribers.forEach((notifier) => {
                        notifier(previousValue);
                    });
                }
            });

            const patchPrototypeWithWatcher = (prototype: Updatable, key: PropertyKey) => {
                const subscriptionKey: unique symbol = Symbol();

                const configureSetter = (target: Updatable) => Object.defineProperty(target, key, {
                    configurable: false,
                    enumerable: true,
                    get(): ReturnType<F> {
                        // Run thunk if one exists
                        thunk?.();

                        return currentValue;
                    },
                });

                // Immediately try to configure property descriptor
                configureSetter(prototype);

                const connect = prototype.connectedCallback;
                prototype.connectedCallback = function() {
                    // Call super/existing
                    connect?.call(this);

                    // Create reference to `this`
                    const ctx: Updatable & { [subscriptionKey]?: () => void } = this;

                    // Dirty property descriptor protector
                    if (typeof Object.getOwnPropertyDescriptor(ctx, key)?.get !== 'function') {
                        // Repair property descriptor
                        configureSetter(ctx);
                    }

                    // Unsubscribe if an existing subscription exists
                    ctx[subscriptionKey]?.();

                    // Create new subscription
                    ctx[subscriptionKey] = subscribe((previousValue: ReturnType<F>) => {
                        ctx.requestUpdate(key, previousValue);
                    });
                };

                // Unsubscribe on disconnect
                const disconnect = prototype.disconnectedCallback;
                prototype.disconnectedCallback = function() {
                    // Create reference to `this`
                    const ctx: Updatable & { [subscriptionKey]?: () => void } = this;

                    // Unsubscribe if an existing subscription exists
                    ctx[subscriptionKey]?.();

                    // Call super/existing
                    disconnect?.call(this);
                };
            };

            // Handle for TC39 Decorators proposal implementations
            if (propertyKey === undefined) {
                // Cast to ClassElement when handling a TC39 Decorators proposal ClassElement
                const classElement = target as ClassElement;

                // Prevent decorator use on accessors
                if (
                    classElement.kind === 'method' &&
                    classElement.descriptor !== undefined &&
                    !('value' in classElement.descriptor)
                ) {
                    throw new Error(`Unable to decorate an accessor ("${String(classElement.key)}")`);
                }

                return {
                    // Run once on class creation
                    finisher(clazz: typeof Updatable) {
                        // Patch watcher logic into class prototype
                        patchPrototypeWithWatcher(clazz.prototype, classElement.key);
                    },

                    // Run on every instance creation
                    initializer(this) {
                        if (typeof classElement.initializer === 'function') {
                            this[classElement.key as string] = classElement.initializer?.call(this);
                        }
                    },

                    // The `finisher` above takes care of defining the property, but we still
                    // must return some kind of descriptor, so return a descriptor for an
                    // unused prototype field.
                    descriptor: {},
                    key: Symbol(),
                    kind: 'field',
                    placement: 'own',
                };
            }

            // Handle for legacy experimentalDecorators implementations
            patchPrototypeWithWatcher(target as T, propertyKey);

            // Default return
            return;
        };
    };
}
