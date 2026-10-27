# Plan: retry failed uploads

## T1: Add the retry helper
- size: S
- depends: none
- files: src/retry.mjs (new)
- verify: a unit test shows a failed upload is retried twice before it gives up

## T2: Wire the helper into the uploader
- size: M
- depends: T1
- files: src/upload.mjs (new)
- verify: the upload test fails when retries are off and passes when they are on

## T3: Rework the whole dashboard theme and the billing pages
- size: L
- depends: none
- files: src/theme.mjs (new), src/billing.mjs (new)
- verify: the theme snapshot test passes
