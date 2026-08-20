# Andromeda Esports Website

Andromeda Esports Website is a web platform built for Andromeda Esports to showcase the organization, teams, rosters, schedules, tournaments, match results, media, and community information while also providing authorized staff with administrative tools.

This project began as my first large-scale web development project and has grown into a Firebase-backed application with authentication, staff permissions, team-based authorization, content management, responsive design, validation, automated project checks, and production deployment preparation.

The project is currently under active development and is approaching its initial production release.

## Current Features

### Public Website

* Organization homepage and branding
* Team directory
* Individual team pages
* Player and staff roster information
* Match schedules and results
* Tournament and competition pages
* Community and social links
* Media and carousel content
* Responsive desktop, tablet, and mobile layouts
* Mobile navigation
* Custom 404 page
* Open Graph metadata for Discord and social link previews
* Search engine crawler configuration

### Staff Administration

The website includes a protected staff dashboard using Firebase Authentication and role-based authorization.

Current staff roles include:

* Super Admin
* Owner
* Admin
* Media
* Manager
* Captain

Staff access is managed through an invitation system. An authorized email address is assigned a role, and when that user signs in, the website connects their Firebase Authentication UID to their staff access record.

Managers and Captains can be assigned to specific teams and are restricted to the team they are authorized to manage.

Administrative tools include:

* Staff access management
* Team and roster management
* Player trial management
* Match management
* Tournament management
* Schedule and calendar management
* Media Hub management
* Site analytics
* Audit logs

The dashboard changes based on the authenticated user's role and permissions.

## Authorization and Security

The website uses multiple layers of authorization and security.

Firebase Authentication identifies the signed-in user.

Staff access records determine the user's role, active status, and assigned team.

Application permissions determine which dashboard features are available to each role.

Cloud Firestore Security Rules enforce backend data permissions.

Cloud Storage Security Rules are prepared for protected media uploads.

Firebase App Check integration is being prepared as an additional layer of protection against unauthorized application traffic.

Frontend visibility is not treated as the main security boundary. Protected Firestore operations are independently validated by Firebase Security Rules.

Managers and Captains are restricted using their assigned team ID.

## Technologies Used

* HTML5
* CSS3
* Vanilla JavaScript
* JavaScript ES Modules
* Firebase Authentication
* Cloud Firestore
* Firebase Security Rules
* Firebase Storage
* Firebase Hosting
* Firebase App Check
* Google reCAPTCHA Enterprise
* Node.js project validation scripts
* Git
* GitHub

## Responsive Design

The website supports desktop, tablet, and mobile layouts.

Responsive improvements include:

* Mobile navigation
* Mobile-friendly team cards
* Touch-friendly controls
* Responsive typography and spacing
* Mobile-specific handling of desktop hover interactions
* Responsive admin forms and interfaces
* Protection against unintended horizontal page overflow

Desktop hover previews are preserved where appropriate, while touch devices use simplified interactions.

## Firebase Architecture

### Authentication

Firebase Authentication is used to identify staff members and provide the UID used by the authorization system.

### Cloud Firestore

Cloud Firestore stores dynamic application data including:

* Staff access records
* Staff invitations
* Rosters
* Trials
* Matches
* Tournaments
* Site content
* Analytics events
* Audit logs

### Cloud Storage

Firebase Storage support is being prepared for staff-managed uploads such as carousel images and Media Hub content.

Production Storage activation is still pending Firebase billing and configuration.

### Firebase Hosting

Firebase Hosting configuration is included in the project and is intended to host the production website.

### Firebase App Check

Firebase App Check integration is being prepared using reCAPTCHA Enterprise.

App Check enforcement will only be enabled after production traffic has been tested and verified.

## Staff Permission Model

The authorization system is designed to give staff only the access required for their role.

Super Admin has full administrative access.

Owner and Admin roles have broad organization-level access.

Media staff can manage media-related content.

Managers can access management tools for their assigned team.

Captains can access permitted Captain tools for their assigned team.

A Manager or Captain assigned to one team cannot modify another team's protected data.

These restrictions are enforced through both application logic and Firebase Security Rules.

## Project Validation

The repository includes automated checks for:

* JavaScript syntax
* Role and authorization behavior
* Dashboard visibility
* Routes
* Internal HTML links and asset references

The current validation suite can be run with:

`npm run check`

Additional Firebase Security Rules emulator testing is planned as part of final production validation.

## Local Development

The website is developed and tested locally before changes are pushed to GitHub and eventually deployed to Firebase Hosting.

A local development server such as VS Code Live Server can be used to run the website during development.

## Project Structure

The project is organized into separate areas for public pages, administration tools, styling, JavaScript modules, Firebase services, configuration, and security rules.

Major folders and files include:

* `admin` for the staff administration interface
* `css` for styling and responsive design
* `images` for branding and static assets
* `js/admin` for admin interface logic
* `js/config` for application configuration
* `js/core` for Firebase and core application setup
* `js/pages` for page-specific JavaScript
* `js/services` for application and data services
* `pages` for public website pages
* `firestore.rules` for Cloud Firestore Security Rules
* `storage.rules` for Cloud Storage Security Rules
* `firebase.json` for Firebase configuration
* `index.html` for the homepage
* `package.json` for project scripts and configuration

## Current Project Status

The project is currently in pre-production testing and launch preparation.

Most major application functionality has been implemented.

Current development work is focused on:

* Mobile and responsive testing
* Firebase Security Rules verification
* Firebase Hosting deployment
* Production domain configuration
* Firebase Storage activation and upload testing
* Firebase App Check production setup
* Real staff account permission testing
* Browser compatibility testing
* Performance optimization
* Final bug fixes

The current focus is stabilizing and testing the existing application rather than continuing to expand the initial release scope.

## What I Am Learning

This project has given me hands-on experience with:

* HTML and CSS
* Responsive web design
* JavaScript
* ES modules
* DOM manipulation
* Firebase Authentication
* Cloud Firestore
* Data modeling
* Role-based authorization
* Security Rules
* Client-side validation
* Error handling
* Admin dashboard development
* Application structure
* Version control
* GitHub workflows
* Deployment preparation
* Production testing

As my first large-scale web development project, Andromeda has evolved alongside my understanding of how real applications are structured, secured, tested, and maintained.

## Development Status

This repository is under active development.

Some infrastructure features, including production Firebase Storage and App Check enforcement, are intentionally not active yet while testing and deployment preparation continue.

Version changes are documented through GitHub commits and releases.
