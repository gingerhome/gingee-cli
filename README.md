# GingerJS CLI: Command Reference

The `gingerjs-cli` is the official, all-in-one command-line interface for the GingerJS platform. It is a powerful tool for both developers and system administrators, designed to streamline every phase of the application lifecycle, from initial project creation to ongoing production management.

## Installation

The `gingerjs-cli` is designed to be installed globally on your machine, making it available everywhere.

```bash
npm install -g gingerjs-cli
```
After installation, you will have access to the `gingerjs-cli` command in your terminal.

---

## Commands

### Project Initialization

This is the main entry point for starting a new GingerJS project.

#### `init <project-name>`

Scaffolds a complete, new GingerJS project in a new directory. It launches an interactive wizard to guide you through the setup.

**Usage:**
```bash
gingerjs-cli init my-awesome-project```
```

**Wizard Prompts:**
-   `Administrator Username for glade:` Sets the initial username for the bundled Glade admin panel. Defaults to `admin`.
-   `Administrator Password for glade:` Securely prompts for the admin password. This is hashed and stored in Glade's configuration.
-   `Install npm dependencies automatically?` If yes (default), it will run `npm install` so the project is ready to run immediately.

---

### Local Scaffolding

These commands should be run from the root directory of an existing GingerJS project.

#### `add-app <app-name>`

Scaffolds a new, working "hello world" application inside your project's `web` directory.

**Usage:**
```bash
gingerjs-cli add-app my-blog
```

**Wizard Prompts:**
-   `What type of app is this?` Choose between `MPA` (Multi-Page App, default) or `SPA` (Single Page Application, for React/Vue/Angular).
-   `Would you like to configure a database connection?` If yes, it will guide you through setting up the `db` block in the new app's `app.json`.
-   `Generate a JWT secret for this app?` If yes, it will automatically generate a secure secret and add it to `app.json`.

#### `add-script <app-name> <script-path>`

Quickly creates a new server script file, pre-populated with the standard GingerJS boilerplate.

**Usage:**
```bash
gingerjs-cli add-script my-blog api/posts
```
Creates ./web/my-blog/box/api/posts.js

---

### Server Administration

These commands interact with the API of a live, running `glade` instance. They require you to be authenticated via the `login` command.

#### `login [server-url]`

Authenticates the CLI with a Glade admin panel and saves the session for subsequent commands.

**Usage:**
-  Login to a local server
```bash
gingerjs-cli login
```

-  Login to a remote server
```bash
gingerjs-cli login https://prod.my-server.com
```

**Options:**
-   `-u, --username <username>`: Provide the username non-interactively. Defaults to `admin`.
-   `-p, --password <password>`: Provide the password non-interactively. If this option is omitted, you will be securely prompted to enter a password.

#### `logout [server-url]`

Logs out of a specific Glade session by deleting the stored credentials.

**Usage:**
```bash
gingerjs-cli logout https://prod.my-server.com
```

#### `list-apps`

Lists all applications installed on the target server.

**Usage:**
```bash
gingerjs-cli list-apps --server https://prod.my-server.com
```

**Options:**
-   `-s, --server <url>` (Optional): The base URL of the target GingerJS server. Defaults to the server you last logged into, or `http://localhost:7070`.

---

### Application Lifecycle Management

These powerful commands allow for remote deployment and management of your applications.

| Command | Description |
| :--- | :--- |
| **`package-app`** | Packages a live application from the server into a distributable `.gin` archive file. |
| **`install-app`** | Installs a new application onto a server from a local `.gin` package file. |
| **`upgrade-app`** | Upgrades an existing application on a server using a new `.gin` package file. |
| **`delete-app`** | Permanently deletes an application and all its content from the server. |

**Common Options for Lifecycle Commands:**
-   `-s, --server <url>` (Optional): The URL of the target server. Defaults to the last-logged-in server.
-   `-a, --appName <app-name>` (Required): The name of the target application.
-   `-p, --ginPath <path>` (Required for install/upgrade): The path to the local `.gin` package file.

**Example Usage:**```bash
# Upgrade the 'my-blog' app on a production server
gingerjs-cli upgrade-app --appName my-blog --ginPath ./builds/my-blog-v2.gin --server https://prod.server```

---

### Backup & Recovery

Commands for the disaster recovery and rollback features.

| Command | Description |
| :--- | :--- |
| **`list-app-backups`** | Lists all available `.gin` backup files for an application stored on the server. |
| **`rollback-app`** | Rolls an application back to its most recently created backup on the server. |

**Common Options for Recovery Commands:**
-   `-s, --server <url>` (Optional): The URL of the target server.
-   `-a, --appName <app-name>` (Required): The name of the target application.

---

### Service Management

Commands for running GingerJS as a native background service. These commands must be run from a project's root directory and typically require `sudo` or Administrator privileges.

-   **`service install`**: Installs and starts the server as a background service.
-   **`service uninstall`**: Stops and removes the background service.
-   **`service start`**: Manually starts the installed service.
-   **`service stop`**: Manually stops the installed service.

### Local Utilities

-   **`reset-pwd`**: A local recovery tool. Prompts for a new admin user password for `glade` admin panel.
-   **`reset-glade`**: A local recovery tool that performs a clean re-installation or reset of the `glade` admin panel.
