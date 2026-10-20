DAR AL-HAFEZ - LOCAL GITHUB LINK + CLICK-TO-UPLOAD

Copy these two .bat files into the project root, beside index.html and Code.gs.

FIRST TIME ONLY:
1) Run 1-link-project-to-main.bat
2) It fetches GitHub and links your local main branch to origin/main.
3) It does NOT upload files. It preserves local files and restores any tracked GitHub files missing from the local folder.
4) Review git status shown at the end.

WHEN YOU WANT TO UPLOAD LATER:
Run 2-upload-to-github.bat. It fetches first, refuses to push if GitHub has newer commits, shows changed files, asks twice for confirmation, commits, then pushes. It never force-pushes.

IMPORTANT:
- Confirm you are in the correct project folder.
- Review the staged file list for unwanted deletions, secrets, API keys, or real student data.
- Do not upload private student data or credentials.
- These scripts are prepared for https://github.com/MO350AZ/attendance.git and branch main.
- The scripts have not been run on your PC; the first linking step is still for you to run locally.
