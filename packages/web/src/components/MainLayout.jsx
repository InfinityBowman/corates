import Navbar from './Navbar.jsx';

export default function MainLayout(props) {
  return (
    <div class='min-h-screen bg-gray-900'>
      <Navbar />
      <main class='text-white'>{props.children}</main>
    </div>
  );
}
