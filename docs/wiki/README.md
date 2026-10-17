# Wiki source

These pages are the source of truth for the
[project wiki](https://github.com/theomgdev/AlienLifeEngine/wiki). They stay in
the main repository so a documentation change is reviewable beside the code it
describes.

`.github/workflows/publish-wiki.yml` mirrors this directory to GitHub's separate
wiki repository whenever `docs/wiki/` changes on `master`. `README.md` explains
the sync and is deliberately not published as a wiki page.

Edit a wrong page here, in a pull request, rather than only in the Wiki UI.
Direct Wiki UI edits will be replaced by the next source sync.
