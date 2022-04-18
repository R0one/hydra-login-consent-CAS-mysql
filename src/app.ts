// Copyright © 2022 Ory Corp
// SPDX-License-Identifier: Apache-2.0

import express, { NextFunction, Response, Request } from "express"
import path from "path"
import logger from "morgan"
import cookieParser from "cookie-parser"
import bodyParser from "body-parser"

import url from "url"

import routes from "./routes"
import login from "./routes/login"
import logout from "./routes/logout"
import consent from "./routes/consent"


import { cas } from './cas/cas'

import { hydraAdmin } from './config'
import { oidcConformityMaybeFakeAcr } from './routes/stub/oidc-cert'

import session = require('express-session');

const app = express()

// view engine setup
app.set("views", path.join(__dirname, "..", "views"))
app.set("view engine", "pug")

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger("dev"))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(cookieParser())
app.use(express.static(path.join(__dirname, "public")))

app.use("/", routes)
app.use("/login", login)
app.use("/logout", logout)
app.use("/consent", consent)

// Set up an Express session, which is required for CASAuthentication.
app.use( session({
    secret            : 'super secret key',
    resave            : false,
    saveUninitialized : true
}));


// Unauthenticated clients will be redirected to the CAS login and then back to
// this route once authenticated.
app.get('/loginCAS', cas.bounce, function ( req, res, next ) {
  // at this point it is possible to retrieve CAS data:
  var s: any = req.session;
  // res.send( '<html><body>'+<string>s[ cas.session_name ]+JSON.stringify(s[ cas.session_info ])+'</body></html>' );

  
  // Parses the URL query
  const query = url.parse(req.url, true).query

  // The challenge is used to fetch information about the login request from ORY Hydra.
  const challenge = String(query.login_challenge)
  if (!challenge) {
    next(new Error('Expected a login challenge to be set but received none.'))
    return
  }


  if (!s[ cas.session_name ]) {
    // Looks like the CAS middleware did not write any identity
    return (
      hydraAdmin
        .rejectLoginRequest(challenge, {
          error: '  failed',
          error_description: 'The consent server couldn\'t retrieve identity from the CAS server.'
        })
        .then(({ data: body }) => {
          // All we need to do now is to redirect the browser back to hydra!
          res.redirect(String(body.redirect_to))
        })
        // This will handle any error that happens when making HTTP calls to hydra
        .catch(next)
    )
  }

  // Seems like the user authenticated! Let's tell hydra...

  hydraAdmin
    .getLoginRequest(challenge)
    .then(({ data: loginRequest }) =>
      hydraAdmin
        .acceptLoginRequest(challenge, {
          // Subject is an alias for user ID. A subject can be a random string, a UUID, an email address, ....
          subject: s[ cas.session_name ],

          // This tells hydra to remember the browser and automatically authenticate the user in future requests. This will
          // set the "skip" parameter in the other route to true on subsequent requests!
          remember: Boolean(req.body.remember),

          // When the session expires, in seconds. Set this to 0 so it will never expire.
          remember_for: 3600,

          // Sets which "level" (e.g. 2-factor authentication) of authentication the user has. The value is really arbitrary
          // and optional. In the context of OpenID Connect, a value of 0 indicates the lowest authorization level.
          // acr: '0',
          //
          // If the environment variable CONFORMITY_FAKE_CLAIMS is set we are assuming that
          // the app is built for the automated OpenID Connect Conformity Test Suite. You
          // can peak inside the code for some ideas, but be aware that all data is fake
          // and this only exists to fake a login system which works in accordance to OpenID Connect.
          //
          // If that variable is not set, the ACR value will be set to the default passed here ('0')
          acr: oidcConformityMaybeFakeAcr(loginRequest, '0')
        })
        .then(({ data: body }) => {
          // All we need to do now is to redirect the user back to hydra!
          res.redirect(String(body.redirect_to))
        })
    )
    // This will handle any error that happens when making HTTP calls to hydra
    .catch(next)

  // You could also deny the login request which tells hydra that no one authenticated!
  // hydra.rejectLoginRequest(challenge, {
  //   error: 'invalid_request',
  //   errorDescription: 'The user did something stupid...'
  // })
  //   .then(({body}) => {
  //     // All we need to do now is to redirect the browser back to hydra!
  //     res.redirect(String(body.redirectTo));
  //   })
  //   // This will handle any error that happens when making HTTP calls to hydra
  //   .catch(next);
  
})


// catch 404 and forward to error handler
app.use((req, res, next) => {
  next(new Error("Not Found"))
})

// error handlers

// development error handler
// will print stacktrace
if (app.get("env") === "development") {
  app.use((err: Error, req: Request, res: Response) => {
    res.status(500)
    res.render("error", {
      message: err.message,
      error: err,
    })
  })
}

// production error handler
// no stacktraces leaked to user
app.use((err: Error, req: Request, res: Response) => {
  res.status(500)
  res.render("error", {
    message: err.message,
    error: {},
  })
})

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack)
  res.status(500).render("error", {
    message: JSON.stringify(err, null, 2),
  })
})

const listenOn = Number(process.env.PORT || 3000)
app.listen(listenOn, () => {
  console.log(`Listening on http://0.0.0.0:${listenOn}`)
})
