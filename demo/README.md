[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/VeliovGroup/Meteor-Files)

Demo app
======
__Links:__
 - __[Heroku hosted Live Demo](http://meteor-files.herokuapp.com)__

__Functionality:__
 - Upload / Download Files
 - Stream Audio / Video Files

Deploy to Heroku
======
 - Go to [Heroku](https://signup.heroku.com/dc) create and confirm your new account
 - Go though [Node.js Tutorial](https://devcenter.heroku.com/articles/getting-started-with-nodejs)
 - Install [Heroku Toolbet](https://devcenter.heroku.com/articles/getting-started-with-nodejs#set-up)
 - Then go to Terminal into Meteor's project directory and run:

```shell
meteor build ../build-<your-app-name> --architecture os.linux.x86_64
cd ../build-<your-app-name>
tar xvzf <name-of-archive> -C ./
cd bundle/
cp -Rf * ../
cd ../
rm -Rf bundle/
rm -Rf <name-of-archive>
git init 
git add .
nano Procfile
web: node main.js
# press ctrl + o
# press Enter (return)
# press ctrl + x
npm init
# go though all steps by pressing Enter (return)
npm install --save fibers@1.0.8 meteor-promise@0.5.1 underscore@1.5.2 semver@4.1.0 progress http-proxy sockjs keypress stream-buffers request useragent mongodb mime connect --production
# Ignore all warnings (but not errors)
heroku create <your-app-name> --buildpack https://github.com/heroku/heroku-buildpack-nodejs
# This command will output something like: https://<your-app-name>.herokuapp.com/ | https://git.heroku.com/<your-app-name>.git
# Copy this: `http://<your-app-name>.herokuapp.com`, note use only `http://` protocol!
heroku config:set ROOT_URL=http://<your-app-name>.herokuapp.com
# To have a MongoDB, you can create one at https://mlab.com/
# After creating MongoDB instance create user, then copy URL to your MongoDB
# Should be something like: mongodb://<dbuser>:<dbpassword>@dt754268.mlab.com:19470/mydb
heroku config:set MONGO_URL=mongodb://<dbuser>:<dbpassword>@dt754268.mlab.com:19470/mydb
git commit -m "initial"
git push heroku master
```
 - Go to `http://<your-app-name>.herokuapp.com`
 - If you app has errors:
   * Check logs: `heroku logs --tail`
   * Try to run locally and debug: `heroku run node`