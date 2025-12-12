import { Link, useLocation } from 'react-router-dom';
import { MapPin, Home, Search, Calendar, Globe } from 'lucide-react';
import { Button } from './ui/button';

export function Navigation() {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bg-white/80 backdrop-blur border-b border-indigo-100 sticky top-0 z-50 py-2">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700">
            <MapPin className="size-6" />
            <span className="text-xl font-bold">TripSync</span>
          </Link>
          
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant={isActive('/') ? 'default' : 'ghost'}
              className={isActive('/') ? 'bg-indigo-600' : ''}
            >
              <Link to="/">
                <Home className="size-4 mr-2" />
                Home
              </Link>
            </Button>
            <Button
              asChild
              variant={isActive('/discover') ? 'default' : 'ghost'}
              className={isActive('/discover') ? 'bg-indigo-600' : ''}
            >
              <Link to="/discover">
                <Search className="size-4 mr-2" />
                Discover
              </Link>
            </Button>
            <Button
              asChild
              variant={isActive('/plan') ? 'default' : 'ghost'}
              className={isActive('/plan') ? 'bg-indigo-600' : ''}
            >
              <Link to="/plan">
                <Calendar className="size-4 mr-2" />
                Plan Trip
              </Link>
            </Button>
            <Button
              asChild
              variant={isActive('/browse') ? 'default' : 'ghost'}
              className={isActive('/browse') ? 'bg-indigo-600' : ''}
            >
              <Link to="/browse">
                <Globe className="size-4 mr-2" />
                Browse
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}

