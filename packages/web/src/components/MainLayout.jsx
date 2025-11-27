import Navbar from './Navbar.jsx';

export default function MainLayout(props) {
  return (
    <div class='h-screen flex flex-col bg-blue-50 overflow-hidden'>
      <Navbar />
      <main class='flex-1 overflow-auto text-gray-900'>{props.children}</main>
    </div>
  );
}
