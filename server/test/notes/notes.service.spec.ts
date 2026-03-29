import { Test } from '@nestjs/testing';
import { NotesService } from '../../src/notes/notes.service';
import { DatabaseService } from '../../src/database/database.service';

describe('NotesService', () => {
  let service: NotesService;
  let db: any;

  beforeEach(async () => {
    db = {
      getTicketNotes: jest.fn().mockReturnValue([]),
      addTicketNote: jest.fn().mockReturnValue({ lastInsertRowid: 1 }),
      updateTicketNote: jest.fn(),
      deleteTicketNote: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        NotesService,
        { provide: DatabaseService, useValue: db },
      ],
    }).compile();

    service = module.get(NotesService);
  });

  it('gets notes for ticket', () => {
    const notes = [{ id: 1, content: 'Test note', agent_name: 'patrik' }];
    db.getTicketNotes.mockReturnValue(notes);

    expect(service.getForTicket('conv-1')).toEqual(notes);
    expect(db.getTicketNotes).toHaveBeenCalledWith('conv-1');
  });

  it('adds note to ticket', () => {
    service.add('conv-1', 'patrik', 'This is a note');
    expect(db.addTicketNote).toHaveBeenCalledWith('conv-1', 'patrik', 'This is a note');
  });

  it('updates note content', () => {
    service.update(5, 'Updated content');
    expect(db.updateTicketNote).toHaveBeenCalledWith(5, 'Updated content');
  });

  it('deletes note', () => {
    service.delete(5);
    expect(db.deleteTicketNote).toHaveBeenCalledWith(5);
  });
});
