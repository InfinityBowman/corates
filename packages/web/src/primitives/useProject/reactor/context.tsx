import { createContext } from 'react';
import type { ProjectReactor } from './core';

export const ProjectReactorContext = createContext<ProjectReactor | null>(null);
