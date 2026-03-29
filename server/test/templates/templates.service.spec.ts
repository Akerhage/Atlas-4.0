import { Test } from '@nestjs/testing';
import { TemplatesService } from '../../src/templates/templates.service';
import { DatabaseService } from '../../src/database/database.service';

describe('TemplatesService', () => {
  let service: TemplatesService;
  let db: any;

  beforeEach(async () => {
    db = {
      getAllTemplates: jest.fn().mockReturnValue([]),
      saveTemplate: jest.fn().mockReturnValue({ lastInsertRowid: 1 }),
      deleteTemplate: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        TemplatesService,
        { provide: DatabaseService, useValue: db },
      ],
    }).compile();

    service = module.get(TemplatesService);
  });

  it('gets all templates', () => {
    const templates = [{ id: 1, name: 'Welcome', subject: 'Välkommen', body: '<p>Hej</p>' }];
    db.getAllTemplates.mockReturnValue(templates);

    expect(service.getAll()).toEqual(templates);
  });

  it('saves new template', () => {
    service.save({ name: 'New', subject: 'Subject', body: '<p>Body</p>' });
    expect(db.saveTemplate).toHaveBeenCalledWith({ name: 'New', subject: 'Subject', body: '<p>Body</p>' });
  });

  it('updates existing template', () => {
    service.save({ id: 5, name: 'Updated', subject: 'Subject', body: '<p>Updated</p>' });
    expect(db.saveTemplate).toHaveBeenCalledWith(expect.objectContaining({ id: 5 }));
  });

  it('deletes template', () => {
    service.delete(5);
    expect(db.deleteTemplate).toHaveBeenCalledWith(5);
  });
});
