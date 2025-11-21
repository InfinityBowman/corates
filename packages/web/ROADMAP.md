# Frontend Roadmap

- [ ] **Navbar**
  - [x] Add a top navigation bar to all pages
  - [x] Show app name/logo
  - [x] Add login/logout button (integrate with authentication)
  - [ ] Make it look pretty

- [ ] **Authentication**
  - [x] Integrate sign in/sign out flow
  - [x] Integrate sign up flow
  - [x] Use HttpOnly cookies and refresh token
  - [x] Show/hide features based on authentication state
  - [x] Mock email verification
  - [ ] Mock password reset
  - [ ] Real email verification
  - [ ] Real password reset
  - [ ] Mock change email
  - [ ] Real change email

- [ ] **Landing Page**
  - [ ] Create a welcoming landing page
  - [x] Show app description
  - [x] Show login/register prompt
  - [ ] Maybe also have statically rendered about page
  - [ ] This page should be statically rendered and function perfectly if JavaScript is disabled

- [ ] **Create Project Page**
  - [ ] Form or dialog to create a new project (name, description, etc.)
  - [ ] Optionally make the project collaborative (must be logged in)
  - [ ] Optionally add collaborators (must be a collaborative project and logged in)
  - [ ] Need some way to search for existing users
  - [ ] Add project to user’s project list

- [ ] **App Dashboard**
  - [ ] Main dashboard for the app, shows all projects/checklists etc.
  - [ ] Lets you make new projects and checklists (maybe quick checklist goes here)

- [ ] **User Profile/Settings Page**
  - [ ] Change name/settings etc.
  - [ ] Delete account

- [ ] **AMSTAR 2 Checklists**
  - [ ] Import/Export checklists to/from CSV
  - [x] Customize critical/noncritical items for scoring
  - [x] Automatic saving
  - [x] Automatic yes/partial yes/no based on answers
  - [ ] Checklist state could be encoded into url
  - [ ] Make it way prettier
  - [x] Checklists-name based URLs
  - [ ] Info for how to complete each question for AMSTAR2

- [ ] **Merge Editor**
  - [ ] Compare two checklists in a merge editor

- [ ] **Project Dashboard**
  - [ ] Export data visualization in color or greyscale
  - [ ] Sort projects in data viz
  - [x] Data visualizations for all checklists in a project
  - [ ] Responsive sizing of visualizations (tailwind selectors?)
  - [ ] Import/Export project to/from CSV
  - [ ] Collaborative project will look different
  - [x] Project-name based URLs

- [ ] **Collaborative Project Dashboard**
  - [ ] Randomly assign reviews to people
  - [ ] Show who has completed reviews
  - [ ] Show who is assigned to which reviews

- [ ] **Sidebar**
  - [x] List projects and their checklists (expandable/collapsible)
  - [x] Updating checklist data should update the sidebar

- [ ] **PDF Viewer**
  - [ ] View PDFs and search through them

- [ ] **Testing**
  - [x] Vitest for basic testing
  - [x] Business logic testing
  - [x] Automated testing with actions
  - [ ] Playwright for advanced integration testing

- [ ] **Analytics**
  - [ ] Analytics monitoring, posthog or do it manually and store in db?
  - [x] Initial page load analytics

- [ ] **Helper Popover**
  - [ ] ? icon that we can place to give users tips/info about things
  - [ ] Make these hide-able in settings
  - [ ] Ex: What does it mean for something to be a critical item

- [ ] **Quick Checklist**
  - [ ] Let a user quickly score a review with pdf without creating a project
  - [ ] Allow import/export to do this

- [ ] **404 Page**
  - [ ] Nice 404 page that helps users find the page they are looking for

- [ ] **Offline Guard**
  - [ ] Pages and features that require online status should be guarded/informative

- [ ] **Docs Pages**
  - [ ] explain how to do things

- [ ] **Misc**
  - [ ] Use Server-Sent Events (EventSource api) for server driven updates
  - [x] Use solid router to control navigation between checklists, projects, etc.
    - makes it so back and forward buttons work properly
  - [x] Better loading components
  - [x] Icons: https://solid-icons.vercel.app/
  - [x] UI library: https://zagjs.com/overview/installation

Format needs to be updated to create a review, then add checklists to that review

- pdfs can be linked to reviews
- Checklists dont need a name since reviews have that
- Polish up the checklist page
  - navbar, pdf viewer, edit the review it's part of

## Sync Plan

### Read

- Use createShape to pull from ElectricSQL when online.
- Add a layer for ElectricSQL sync that integrates with my state context and indexeddb.
- ElectricSQL should call AppState methods and those will handle updating indexeddb and
  propogating the state
- Make sure auth is fine, ElectricSQL needs to be integrated with FastAPI or Auth in some way.

### Write

- Need another indexeddb database to track changes and make POST requests when connectivity is regained
- This extra table has things removed from it on successful writes
- We need to be able to handle rejected writes.
  - If the user reconnects and is not logged the server would not allow writes
  - If there is some conflict that prevents the write such as a more recent edit timestamp in the server db

<br><br>_This roadmap is a living document and will be updated as the project evolves._
