# lit-watch

[![MIT](https://img.shields.io/github/license/gerarts/lit-watch.svg)](https://github.com/gerarts/lit-watch/blob/master/LICENSE)
[![NPM](https://img.shields.io/npm/v/lit-watch.svg)](https://www.npmjs.com/package/lit-watch)

Create decorators from redux stores and observables like RxJS objects.

## Install

```
npm i lit-watch
```

## Usage

You can create a decorator from any observable:

```ts
import { createWatcher } from 'lit-watch';

// Create a @watch decorator
export const watch = createWatcher(observable);
```

Use it in your LitElements:

```ts
import { html, LitElement } from 'lit';
import { watch } from './watch';

export class Account extends LitElement {
    @watch((state) => state.user.fullName)
    public user!: string;

    render() {
        return html`
            Signed in as ${this.user}
        `;
    }
}
```

#### NOTE: Use `public` (do not use `private` / `protected`)

One of the goals of `lit-watch` was to force type-checking between the decorator output and the property. Due to a TypeScript limitation, however, the properties with a watching decorator have to be `public`. In a sense, from the scope of the decorator, we are accessing the class type from the outside,
. Because any `private` or `protected` property will be invisible to the decorator, you may see a cryptic error when using these on any non-`public` properties.

#### NOTE: Do not set a default value

The decorator redefines the property with an accessor (`get`), so setting default values does not work. You can add a default in your select function by using a [nullish coalescing operator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing_operator) (`??`).

```ts
// Do
@watch((state) => state.some)
public some!: string;

// Do not
@watch((state) => state.some)
public some: string = 'default value';

// For defaults
@watch((state) => state.some ?? 'default value')
public some!: string;
```

By using `!`, we are letting TypeScript know that this value will be set, so we do not get any errors while using the [`--strictPropertyInitialization`](https://www.typescriptlang.org/docs/handbook/2/classes.html#--strictpropertyinitialization) option.

#### NOTE: Do not use before `connectedCallback`

Do not use `lit-watch` values in your `constructor`, as value accessors are initialized and subscribed in the `connectedCallback` and will unsubscribe in the `disconnectedCallback`.

### Creating a decorator from a redux store

Since [redux is interoperable with observable/reactive libraries](https://github.com/reduxjs/redux/blob/1d1101a92b6476907728966aa9a2b3c8669d8ece/src/types/store.ts#L216..L222) you can watch redux stores like any other observable.

Create the decorator from your redux store:

```ts
import { createWatcher } from 'lit-watch';
import { store } from './store';

// Create a @watch decorator
export const watch = createWatcher(store);
```

### Filtering, transforming and combining data with reselect

You can use [reselect](https://redux-toolkit.js.org/api/createSelector)'s `createSelector` to create complex queries.

One of the benefits of using reselect over writing your own function is that reselect uses memoization to prevent unnecessary updates when the source data has not been changed.

For more information about reselect, see [the reselect docs](https://github.com/reduxjs/reselect).

The examples below show some inline use of reselect, but you are free to pass your selectors from elsewhere.

#### Filtering

```ts
@watch(createSelector(
    (state) => state.messages,
    (messages) => {
        // This only runs if state.messages changed
        return messages.filter((item) => !item.read);
    }
))
public unread!: Message[];
```

#### Transforming

```ts
@watch(createSelector(
    (state) => state.cart.items,
    (items) => {
        // This only runs if state.cart.items changed
        return items.reduce(
            (sum, item) => sum + item.price,
            0,
        );
    }
))
public total!: number;
```

#### Combining

```ts
@watch(createSelector(
    (state) => state.user.name,
    (state) => state.user.cart.items.length,
    (user, items) => {
        // This only runs if either state.user.name, or
        // state.user.cart.items.length changed (or both)
        return `${user} has ${items} in their cart`;
    }
))
public message!: string;
```

### Multiple watchers

If you are planning on watching multiple observables, or maybe even multiple stores, it might make sens to name your decorators something more descriptive.

```ts
// @watchStore()
export const watchStore = createWatcher(store);

// @watchPrice()
export const watchPrice = createWatcher(priceObservable);
```

```ts
export class Account extends LitElement {
    @watchStore((state) => state.item.description)
    public description!: string;

    @watchPrice()
    public price!: number;
```

### Use with Observables and RxJS

You can create watchers from RxJS (and other) observables by passing them to `createWatcher`.

```ts
const watchClimate = createWatcher(climateObservable);
```

## License

[MIT](https://github.com/gerarts/lit-watch/blob/master/LICENSE)

Made by [Paul Gerarts](https://github.com/gerarts)
