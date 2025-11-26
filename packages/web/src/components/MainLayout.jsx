import Navbar from './Navbar.jsx';

export default function MainLayout(props) {
  return (
    <div class='min-h-screen bg-blue-50'>
      <Navbar />
      <main class='text-gray-900'>{props.children}</main>
    </div>
  );
}
