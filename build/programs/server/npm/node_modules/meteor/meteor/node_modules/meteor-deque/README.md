# deque

Wrapper package for [double-ended-queue](https://www.npmjs.com/package/double-ended-queue).

This package currently exists to work around [a
problem](https://github.com/npm/read-installed/issues/40) in the
[read-installed](https://github.com/npm/read-installed/) package (used by
npm) that effectively forbids packages with prerelease versions (like
double-ended-queue@2.1.0-0) from being installed in a top-level
node_modules directory.

In the future, we might supplement this package with our own queue
features, but for now we export the
[double-ended-queue](https://www.npmjs.com/package/double-ended-queue)
module unmodified.
