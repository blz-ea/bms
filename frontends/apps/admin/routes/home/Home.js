/**
 * React Starter Kit (https://www.reactstarterkit.com/)
 *
 * Copyright © 2014-present Kriasoft, LLC. All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import React from 'react';
import withStyles from 'isomorphic-style-loader/lib/withStyles';
import PropTypes from 'prop-types';
import s from './Home.css';
import history from '../../../../history';
import { loggedIn } from '../../../../core/utils';

class Home extends React.Component {
  static contextTypes = {
    store: PropTypes.object.isRequired,
  };

  componentDidMount() {
    if (process.env.BROWSER) {
      const userLoggedIn = loggedIn(this.context.store.getState().user);
      const lastPath = localStorage.getItem('lastPath');
      switch (true) {
        case userLoggedIn:
          if (lastPath) return history.push(lastPath);
          history.push(window.App.defaultRoute);
          break;
        default:
          history.push('/login');
      }
    }
  }

  render() {
    return <div />;
  }
}

export default withStyles(s)(Home);
