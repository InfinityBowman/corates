# Frontend Roadmap

- [ ] **Navbar**
  - [x] Add a top navigation bar to all pages
  - [x] Show app name/logo
  - [x] Add sign in/sign out/ sign up buttons (integrate with authentication)
  - [ ] Make it look pretty

- [ ] **Authentication**
  - [x] Integrate sign in/sign out flow
  - [x] Integrate sign up flow
  - [x] Use HttpOnly cookies and refresh token
  - [x] Show/hide features based on authentication state
  - [x] Real email verification
  - [x] Real password reset
  - [ ] Real change email

- [ ] **Landing Page**
  - [ ] Create a welcoming landing page
  - [x] Show app description
  - [x] Show sign up/sign in prompt
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
  - [ ] Checklist state could be encoded into url for sharing
  - [ ] Make it way prettier
  - [ ] Checklists-name based URLs
  - [ ] Info for how to complete each question for AMSTAR2

- [ ] **Merge Editor**
  - [ ] Compare two checklists in a merge editor

- [ ] **Project Dashboard**
  - [ ] Export data visualization in color or greyscale
  - [ ] Sort projects in data viz
  - [ ] Data visualizations for all checklists in a project
  - [ ] Responsive sizing of visualizations (tailwind selectors?)
  - [ ] Import/Export project to/from CSV
  - [ ] Collaborative project will look different
  - [ ] Project-name based URLs

- [ ] **Collaborative Project Dashboard**
  - [ ] Randomly assign reviews to people
  - [ ] Show who has completed reviews
  - [ ] Show who is assigned to which reviews

- [ ] **Sidebar**
  - [ ] List projects and their checklists (expandable/collapsible)
  - [ ] Updating checklist data should update the sidebar

- [ ] **PDF Viewer**
  - [ ] View PDFs and search through them

- [ ] **Testing**
  - [ ] Vitest for basic testing
  - [ ] Business logic testing
  - [ ] Automated testing with actions
  - [ ] Playwright for advanced integration testing

- [ ] **Analytics**
  - [ ] Analytics monitoring, posthog or do it manually and store in db?
  - [ ] Initial page load analytics

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
  - [x] Use solid router to control navigation between checklists, projects, etc.
    - makes it so back and forward buttons work properly
  - [x] Better loading components
  - [x] Icons: https://solid-icons.vercel.app/
  - [ ] Animated Icons: https://animate-ui.com/docs/icons, https://lucide-animated.com/
  - [x] UI library: https://zagjs.com/overview/installation

- pdfs can be linked to reviews

<br><br>_This roadmap is a living document and will be updated as the project evolves._
