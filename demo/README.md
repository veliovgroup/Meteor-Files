[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/VeliovGroup/Meteor-Files-Demo)

Demo app
======
__Links:__
 - __[Heroku hosted Live Demo](https://meteor-files.herokuapp.com/)__

__Functionality:__
 - Upload / Download Files
 - Stream Audio / Video Files

Deploy to Heroku
======
 - Due to "*ephemeral filesystem*" on Heroku, we suggest to use DropBox as permanent storage, [read DropBox tutorial](https://github.com/VeliovGroup/Meteor-Files/wiki/Third-party-storage)
 - Go to [Heroku](https://signup.heroku.com/dc) create and confirm your new account
 - Go though [Node.js Tutorial](https://devcenter.heroku.com/articles/getting-started-with-nodejs)
 - Install [Heroku Toolbet](https://devcenter.heroku.com/articles/getting-started-with-nodejs#set-up)
 - Then go to Terminal into Meteor's project directory and run:

```shell
# Available architectures:
# os.osx.x86_64
# os.linux.x86_64
# os.linux.x86_32
# os.windows.x86_32
meteor build ../build-<your-app-name> --architecture os.linux.x86_64
cd ../build-<your-app-name>
tar xzf <name-of-archive> -C ./
cd bundle/
cp -Rf * ../
cd ../
rm -Rf bundle/
rm -Rf <name-of-archive>
touch Procfile
echo "web: node main.js" > Procfile

heroku create <your-app-name> --buildpack https://github.com/heroku/heroku-buildpack-nodejs
# This command will output something like: https://<your-app-name>.herokuapp.com/ | https://git.heroku.com/<your-app-name>.git
heroku git:remote -a <your-app-name>

# Copy this: `https://<your-app-name>.herokuapp.com`, note use only `https://` protocol!
heroku config:set ROOT_URL=https://<your-app-name>.herokuapp.com
# To have a MongoDB, you can create one at https://mlab.com/
# After creating MongoDB instance create user, then copy URL to your MongoDB
# Should be something like: mongodb://<dbuser>:<dbpassword>@dt754268.mlab.com:19470/mydb
heroku config:set MONGO_URL=mongodb://<dbuser>:<dbpassword>@dt754268.mlab.com:19470/mydb

git init
git add .
git commit -m "initial"
git push heroku master
```
 - Go to `http://<your-app-name>.herokuapp.com`
 - If you app has errors:
   * Check logs: `heroku logs --tail`
   * Try to run locally and debug: `heroku run node`