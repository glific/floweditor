import { applyMiddleware, createStore, Middleware } from 'redux';
import { composeWithDevTools } from 'redux-devtools-extension';
import thunk from 'redux-thunk';

import rootReducer from 'store/rootReducer';
import AppState, { initialState } from 'store/state';
import storeChangeMiddleware from '../services/indexDB';

const middlewares: Middleware[] = [thunk, storeChangeMiddleware];

export default (state: AppState = initialState) => {
  const store = createStore(
    rootReducer,
    state,
    composeWithDevTools(applyMiddleware(...middlewares))
  );

  /* istanbul ignore next */
  if (module.hot) {
    module.hot.accept('./rootReducer', () => {
      const { default: nextRootReducer } = require('./rootReducer');
      store.replaceReducer(nextRootReducer);
    });
  }

  return store;
};
