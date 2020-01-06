# Includes

A script can include other scripts.  The only rule is that a script cannot include a script that is lower in the directory tree than the root script.  This is because scripts are copied remotely to execute it makes calculation of the tree of scripts to copy easier.

Includes are always evaluated depth first and from top to bottom.  This means that the variables of a script will be evaluated after all included scripts are evaluated.  This allows you to set common variables in one place, for example.