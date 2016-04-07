#!/usr/bin/env bash

cd $(dirname $0)/..

docco install.js
git fetch origin
BRANCH=$(git rev-parse --abbrev-ref HEAD)
tar czvf docs.tgz docs
git checkout gh-pages
git rebase origin/gh-pages
tar xf docs.tgz --strip-components 1
mv install.html index.html
git commit -a -m "Regenerate docs."
git push origin gh-pages
git checkout ${BRANCH}
rm docs.tgz
