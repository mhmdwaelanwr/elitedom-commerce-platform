"""Algolia product-index integration package.

Import task functions explicitly from ``app.integrations.algolia.tasks`` when
registering an outbox route or a periodic job.  Importing this package itself
does not create an SDK client or issue a network request.
"""
