# Wiki source

These pages are the content of the [project wiki](https://github.com/theomgdev/AlienLifeEngine/wiki),
kept here so they are reviewable in pull requests and versioned with the code
they describe. GitHub wikis live in a separate git repository that is not part
of this one, so a change here is published by copying it across:

```
git clone https://github.com/theomgdev/AlienLifeEngine.wiki.git
cp docs/wiki/*.md AlienLifeEngine.wiki/
cd AlienLifeEngine.wiki && git add -A && git commit -m "..." && git push
```

Fix a wrong page here, in a pull request, rather than only in the wiki.
