import { removePachinkoAppData } from '@/lib/cleanAppData';

async function clean() {
  try {
    removePachinkoAppData();
  } catch (error) {
    console.error('Error removing installation:', error);
    process.exit(1);
  }
}

clean();
