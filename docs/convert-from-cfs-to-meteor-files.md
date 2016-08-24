#Convert from the now depreciated CollectionFS (CFS) package to this Meteor-Files Package. 

Here is a quick way to convert your files from one collection to the other.   
I use a "schema update" file that each time meteor starts, it checks a known collection for the database version.
This way you can update things like this without doing it twice.   

This script is used for Amazon S3, you can replace your new Meteor-Files storage location with yours (local, Dropbox, Etc). 

Old package: https://github.com/CollectionFS/Meteor-CollectionFS  


## Run this once on startup (and only once!)
After this completes, you can remove any of the cfs:* packages. 

###Note: this creates copies of the files on your local server, make sure there is enough storage space for them!!
I use docker containers, so the files get wiped out on the next container deployment which is why we don't bother deleting them. 

    let bound = Meteor.bindEnvironment(function (callback) {
            return callback();
        });

        process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

        //s3 specific configuration, knox npm must be installed
        let client = knox.createClient({
            key: Meteor.settings.s3.key,
            secret: Meteor.settings.s3.secret,
            bucket: Meteor.settings.s3.bucket,
            region: Meteor.settings.s3.region

        });
        

        //this is your CFS file collection, change Docs to whatever you call it, Images, etc. 
        //we run through every single document/file that is stored with CFS and move them one by one to Meteor-Files. 
        
        Docs.find().forEach(function (fileObj) {

            //console.log('File: ', fileObj.userId);

            //this must be writeable on your server, so a test run first
            //we are going to copy the files locally, then move them to S3
            
            let fileName = './assets/app/uploads/' + fileObj.name();

            let newFileName = fileObj.name();

            //this is a variable I created, so change it to the userId that you might be using. 
            let userId = fileObj.userId;

            let fileType = fileObj.type();

            let fileSize = fileObj.size();

            var readStream = fileObj.createReadStream('images');
            var writeStream = fs.createWriteStream(fileName);

            writeStream.on('error', function (err) {

                console.log('Writing error: ', err, fileName);

            });

            //once we have the file, then upload it to our new data store
            readStream.on('end', () => {

                console.log('Ended: ', fileName);
                
                
                //UserFiles is the new Meteor-Files/FilesCollection collection
                
                UserFiles.addFile(fileName, {
                    fileName: newFileName,
                    type: fileType,
                    meta: {
                        userId: userId   //not really needed, I use it for tampering detection
                    },
                    userId: userId,
                    size: fileSize
                }, (err, fileRef) => {
                    if (err) {
                        console.log(err);
                    }
                    else {
                        console.log('File Inserted: ', fileRef._id);

                        //set the userId again
                        UserFiles.update({_id: fileRef._id}, {$set: {userId: userId}});

                        let version = 'original';


                        //move to S3 - this is where you need to replace your storage location
                        let filePath = "files/" + (Random.id()) + "-" + version + "." + fileRef.extension;

                        client.putFile(fileName, filePath, {"x-amz-server-side-encryption": "AES256"}, function (error, res) {

                            bound(function () {

                                let upd;

                                if (error) {
                                    console.error(error);
                                }

                                else {
                                    upd = {
                                        $set: {}
                                    };

                                    upd['$set']["versions." + version + ".meta.pipeFrom"] = Meteor.settings.s3.cfdomain + '/' + filePath;
                                    upd['$set']["versions." + version + ".meta.pipePath"] = filePath;

                                    //update the location and unlink the file from the local store
                                    UserFiles.update({
                                        _id: fileRef._id
                                    }, upd, function (error) {

                                        if (error) {
                                            console.error(error);
                                        }
                                        // Unlink original files from FS
                                        // after successful upload to AWS:S3
                                        else {
                                            UserFiles.unlink(UserFiles.findOne(fileRef._id), version);
                                        }
                                    });
                                }
                            });
                        });


                    }
                });

            });

            readStream.on('error', (error) => {
                console.log('Error: ', fileName, error);
            });

            readStream.pipe(writeStream);

        });
