# Security

This is a browser simulation with no backend, no accounts and no data
collection: it runs entirely in your tab, and the hosted demo is static files
on GitHub Pages. The realistic attack surface is a malicious world file, since
loading one parses JSON you were given by someone else.

If you find something that lets a world file or a URL do more than change the
simulation — execute script, reach storage outside the page, or exfiltrate
anything — report it privately through
[Security advisories](https://github.com/theomgdev/AlienLifeEngine/security/advisories/new)
rather than opening an issue.

Expect a reply within a week. There is no bounty; this is one person's project.
