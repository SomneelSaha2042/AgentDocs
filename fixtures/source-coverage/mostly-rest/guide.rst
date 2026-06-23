Guide
=====

This guide introduces the project and links to the tutorial.

.. note::

   Read the tutorial before deploying.

.. warning::

   Do not commit secrets to the repository.

.. code-block:: python

   import os
   print(os.environ.get("API_KEY"))

.. versionadded:: 5.0

   Configuration overrides are now supported.

.. deprecated:: 4.0

   Use ``configure()`` instead of ``setup()``.

See the `tutorial <tutorial.html>`_ for more.
